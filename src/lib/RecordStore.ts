// import type { Container } from '@sapphire/pieces';
import {
	ButtonInteraction,
	CommandInteraction,
	GuildMember,
	Message,
	MessageActionRow,
	MessageButton,
	MessageComponentInteraction,
	MessageEmbed,
	SelectMenuInteraction,
	Util,
	VoiceChannel
} from 'discord.js';
import { yt_validate } from 'play-dl';
import ytsr from 'ytsr';
import ytfps from 'ytfps';
import { identity } from 'lodash';
import { PaginatedMessage } from '@sapphire/discord.js-utilities';
import { container } from '@sapphire/framework';
import { codeBlock, deepClone } from '@sapphire/utilities';
import dedent from 'dedent-js';

export class RecordStore {
	/**
	 * get Song / Playlist Information from a query / an url
	 * @param url url of video / playlist or a query term
	 * @param count maximum number of results that should be returned
	 * @param type type that should be returned, can be ignored when using url, defaults to video when searching for term
	 * @returns found Songs / Playlists
	 */
	public static async getInformation(url: string, count: number, type?: 'video' | 'playlist'): Promise<(Song | Playlist)[]> {
		const urlType = yt_validate(url);
		if (!urlType) return [];

		if (urlType === 'playlist') return [await this.getPlaylist(url)];

		// search term, not search url!
		if (urlType === 'search') url = (await ytsr.getFilters(url)).get('Type')?.get(type === 'playlist' ? 'Playlist' : 'Video')?.url || url;

		const rawResult = await ytsr(url, { limit: count + 5 });

		if (rawResult.results === 0) return [];

		const mappedResults = await Promise.all(
			rawResult.items.map(async (item) => {
				if ((type && item.type !== type) || (item.type !== 'video' && item.type !== 'playlist')) return;
				if (item.type === 'video' && (item.isLive || item.isUpcoming || yt_validate(item.url) !== 'video')) return;
				if (item.type === 'playlist') return this.getPlaylist(item.playlistID);
				return {
					title: Util.escapeMarkdown(item.title),
					id: item.id,
					url: item.url,
					author: item.author?.name ? Util.escapeMarkdown(item.author.name) : undefined,
					uploadedAt: item.uploadedAt ?? undefined,
					views: item.views ?? undefined,
					description: item.description ? Util.escapeMarkdown(item.description) : undefined,
					duration: item.duration ?? undefined,
					thumbnail: item.bestThumbnail.url ?? undefined
				} as Song;
			})
		);
		return mappedResults.filter(identity).filter((_, i) => i < count) as (Song | Playlist)[];
	}

	/**
	 * makes a song / playlist offer in response to the supplied interaction
	 * @param items songs / playlists to offer
	 * @param interaction interaction to reply to
	 * @returns nothing of importance ;)
	 */
	public static async makeOffer(items: (Song | Playlist)[], interaction: CommandInteraction) {
		const paginatedMessage = await this.getOfferMessage(items).run(interaction);
		if (!paginatedMessage.response || !(paginatedMessage.response instanceof Message)) return interaction.followUp('Oops, something went wrong.');

		// TODO upgrade this to .from-syntax in discord.js v14
		const components = deepClone(paginatedMessage.response.components);
		components.push(
			new MessageActionRow().addComponents(
				new MessageButton().setCustomId('recordstore/stop').setEmoji('🗑️').setLabel('abort search').setStyle('DANGER'),
				new MessageButton().setCustomId('recordstore/add').setEmoji('➕').setLabel('add to queue').setStyle('SUCCESS')
			)
		);

		const message = await paginatedMessage.response.edit({ components });

		message
			.createMessageComponentCollector({
				filter: (i) => i.customId === 'recordstore/stop' && i.user.id === interaction.user.id,
				max: 1
			})
			.on('end', () => paginatedMessage.collector?.stop());

		message
			.createMessageComponentCollector({
				filter: (i) => i.customId === 'recordstore/add' && i.user.id === interaction.user.id,
				max: 1
			})
			.on('collect', (i) => this.addToQueue(i, items.at(paginatedMessage.index)))
			.on('end', () => paginatedMessage.collector?.stop());
		return;
	}

	/**
	 * converts a playlist url into a playlist object
	 * @param url playlist url
	 * @returns playlist object
	 */
	private static async getPlaylist(url: string): Promise<Playlist> {
		const rawPlaylist = await ytfps(url);
		return {
			id: rawPlaylist.id,
			title: Util.escapeMarkdown(rawPlaylist.title),
			url: rawPlaylist.url,
			author: Util.escapeMarkdown(rawPlaylist.author.name),
			estimatedItemCount: rawPlaylist.video_count,
			description: Util.escapeMarkdown(rawPlaylist.description),
			thumbnail: rawPlaylist.thumbnail_url,
			views: rawPlaylist.view_count,
			songs: rawPlaylist.videos.flatMap((video) => {
				if (yt_validate(video.url) !== 'video') return [];
				return {
					title: Util.escapeMarkdown(video.title),
					id: video.id,
					url: video.url,
					author: video.author.name,
					duration: video.length ?? undefined,
					thumbnail: video.thumbnail_url ?? undefined
				};
			})
		};
	}

	/**
	 * creates a paginated message based on an array of songs / playlists
	 * @param items the songs / playlists to convert
	 * @returns the resulting paginated message
	 */
	private static getOfferMessage(items: (Song | Playlist)[]): PaginatedMessage {
		const pm = new PaginatedMessage({
			template: { content: 'Please navigate using the arrow buttons and make a selection.' }
		});

		// ACTIONS
		pm.actions.delete('@sapphire/paginated-messages.firstPage');
		pm.actions.delete('@sapphire/paginated-messages.goToLastPage');
		pm.actions.delete('@sapphire/paginated-messages.goToPage');
		pm.actions.delete('@sapphire/paginated-messages.stop');

		// PAGES
		items.forEach((s) => {
			if (!('title' in s)) return;
			const embed = new MessageEmbed({
				title: s.title,
				url: s.url,
				description: s.description
			});
			if (s.thumbnail) embed.setImage(s.thumbnail);
			if (s.views) embed.addField('views:', `${s.views}`, true);
			if (s.author) embed.addField('author:', s.author, true);
			if ('uploadedAt' in s && s.uploadedAt) embed.addField('uploaded:', s.uploadedAt, true);
			if ('duration' in s && s.duration) embed.addField('duration:', s.duration, true);
			if ('estimatedItemCount' in s && s.estimatedItemCount) embed.addField('estimated song count:', s.estimatedItemCount.toString(), true);
			if ('songs' in s) {
				let songsString = '';
				let i = 0;
				while (i < s.songs.length && songsString.length < 1024) {
					songsString += `${i + 1}. ${s.songs[i].title}\n`;
					i++;
				}
				// this could be improved as it is possibly and endless loop
				while (songsString.length > 1024)
					songsString = songsString
						.slice(0, 1020)
						.split('\n')
						.filter(identity)
						.map((v, i, a) => (i + 1 === a.length ? '...' : v))
						.join('\n');
				if (songsString.length > 0) embed.addField('songs:', songsString);
			}
			// add page with embed
			pm.addPage({ embeds: [embed] });
		});
		return pm;
	}

	private static async addToQueue(interaction: ButtonInteraction | SelectMenuInteraction | MessageComponentInteraction, item?: Song | Playlist) {
		if (!item || !interaction.channel || !interaction.guildId || !interaction.member || !('voice' in interaction.member))
			return interaction.reply({ content: 'An error occured. Please try again...', ephemeral: true });
		if (!(await container.bard.isInValidVC(interaction.member as GuildMember))) {
			return interaction.reply({
				content:
					'Please check that:' +
					codeBlock(
						'md',
						dedent`* you are in a voice channel...
						* you are allowed to speak in that voice channel...
						* I am in the same voice channel...
						* or allowed to connect to and speak in that voice channel`
					),
				ephemeral: true
			});
		}
		const newConnection = container.bard.connect(interaction.member.voice.channel as VoiceChannel);

		container.bard.addToQueue(interaction.guildId, item);

		if (newConnection) container.bard.play(interaction.guildId);
		if ('edit' in interaction.message && interaction.message.editable)
			interaction.message.edit(`${interaction.user} chose this ${yt_validate(item.url)}:`);

		container.bard.sendNewJukeBox(interaction.guildId, interaction.channel, 'Added new song to queue');
		return;
	}
}
