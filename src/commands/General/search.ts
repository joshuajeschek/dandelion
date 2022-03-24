import { ApplyOptions } from '@sapphire/decorators';
import { PaginatedMessage } from '@sapphire/discord.js-utilities';
import { ApplicationCommandRegistry, Args, Command, CommandOptions } from '@sapphire/framework';
import { codeBlock } from '@sapphire/utilities';
import {
	ButtonInteraction,
	CommandInteraction,
	Constants,
	GuildMember,
	InteractionCollector,
	Message,
	MessageComponentInteraction,
	MessageEmbed,
	SelectMenuInteraction,
	VoiceChannel
} from 'discord.js';
import ytsr from 'ytsr';
import ytfps from 'ytfps';
import dedent from 'dedent-js';
import { getGuildIds } from '../../lib/env-parser';
import { identity } from 'lodash';
import { yt_validate } from 'play-dl';
import type { YTPlaylist } from 'ytfps/out/interfaces';

@ApplyOptions<CommandOptions>({
	description: 'Search for a song on youtube',
	options: ['query', 'playlist']
})
export class SearchCommand extends Command {
	public async messageRun(message: Message, args: Args) {
		const results = await this.search(args.getOption('query') || undefined, (args.getOption('playlist')?.length || -1) > 0);
		const pm = await this.getResultMessage(results, message);
		return pm.run(message);
	}

	public async chatInputRun(interaction: CommandInteraction) {
		interaction.deferReply();
		const results = await this.search(
			interaction.options.getString('query') || undefined,
			interaction.options.getBoolean('playlist') || undefined
		);
		const pm = await this.getResultMessage(results, interaction);
		return pm.run(interaction);
	}

	private async search(query?: string, playlist?: boolean): Promise<(Song | Playlist)[]> {
		query ||= 'Never gonna give you up';
		const filter = (await ytsr.getFilters(query)).get('Type')?.get(playlist ? 'Playlist' : 'Video');
		const rawResults = await ytsr(filter?.url || query, { limit: 10 });
		const results = this.getResults(rawResults.items, 10, playlist ? 'playlist' : 'video');
		return results;
	}

	private async getResults(items: ytsr.Item[], count: number, type: 'video' | 'playlist'): Promise<(Song | Playlist)[]> {
		const mappedResults = await Promise.all(
			items.map(async (item) => {
				if (item.type !== type) return;
				if (item.type === 'video' && (item.isLive || item.isUpcoming || yt_validate(item.url) !== 'video')) return;
				if (item.type === 'video')
					return {
						title: item.title,
						id: item.id,
						url: item.url,
						author: item.author?.name,
						uploadedAt: item.uploadedAt ?? undefined,
						views: item.views ?? undefined,
						description: item.description ?? undefined,
						duration: item.duration ?? undefined,
						thumbnail: item.bestThumbnail.url ?? undefined
					} as Song;
				const rawPlaylist = await ytfps(item.playlistID);
				return this.getPlaylist(rawPlaylist);
			})
		);
		const filteredResults = mappedResults.filter((_, i) => i < count).filter(identity) as (Song | Playlist)[];
		return filteredResults;
	}

	private getPlaylist(rawPlaylist: YTPlaylist): Playlist {
		return {
			id: rawPlaylist.id,
			title: rawPlaylist.title,
			url: rawPlaylist.url,
			author: rawPlaylist.author.name,
			estimatedItemCount: rawPlaylist.video_count,
			description: rawPlaylist.description,
			thumbnail: rawPlaylist.thumbnail_url,
			views: rawPlaylist.view_count,
			songs: rawPlaylist.videos.flatMap((video) => {
				if (yt_validate(video.url) !== 'video') return [];
				return {
					title: video.title,
					id: video.id,
					url: video.url,
					author: video.author.name,
					duration: video.length ?? undefined,
					thumbnail: video.thumbnail_url ?? undefined
				};
			})
		};
	}

	private async addToQueue(
		interaction: ButtonInteraction | SelectMenuInteraction,
		collector: InteractionCollector<MessageComponentInteraction>,
		handler: PaginatedMessage,
		results: (Song | Playlist)[],
		guildId?: string | null
	) {
		if (!guildId || !interaction.channel || !interaction.member || !('voice' in interaction.member)) return;
		if (!(await this.container.bard.isInValidVC(interaction.member as GuildMember))) {
			return interaction.reply({
				content:
					'Please check that' +
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
		const newConnection = this.container.bard.connect(interaction.member.voice.channel as VoiceChannel);

		this.container.bard.addToQueue(guildId, results[handler.index]);
		if (newConnection) this.container.bard.play(guildId);
		collector.stop();
		if ('edit' in interaction.message && interaction.message.editable) {
			interaction.message.edit(`${interaction.user} chose this ${yt_validate(results[handler.index].url)}:`);
		}
		this.container.bard.sendNewJukeBox(guildId, interaction.channel, 'Added new song to queue');
		return;
	}

	private async getResultMessage(results: (Song | Playlist)[], ctx: CommandInteraction | Message): Promise<PaginatedMessage> {
		const pm = new PaginatedMessage({
			template: { content: 'Please navigate using the arrow buttons and make a selection.' }
		});

		// ACTIONS
		pm.actions.delete('@sapphire/paginated-messages.firstPage');
		pm.actions.delete('@sapphire/paginated-messages.goToLastPage');
		pm.actions.delete('@sapphire/paginated-messages.goToPage');
		const stopAction = pm.actions.get('@sapphire/paginated-messages.stop');
		if (stopAction && stopAction.type === Constants.MessageComponentTypes.BUTTON) {
			stopAction.label = 'abort search';
			stopAction.emoji = '🗑️';
		}
		pm.setStopPaginatedMessageCustomIds(['@sapphire/paginated-messages.stop', 'queue']);
		pm.addAction({
			type: Constants.MessageComponentTypes.BUTTON,
			label: 'add to queue',
			style: 'SUCCESS',
			customId: 'queue',
			emoji: '➕',
			disabled: !ctx.guildId,
			run: ({ interaction, collector, handler }) => this.addToQueue(interaction, collector, handler, results, ctx.guildId)
		});

		// PAGES
		results.forEach((s) => {
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
				// 1024 + 6 because we want to add 6 characters to the end
				if (i < s.songs.length) songsString = songsString.slice(0, 1030 - songsString.length).replace(/[0-9]+\. .*\n*$/, 'n. ...');
				if (songsString.length > 0) embed.addField('songs:', songsString);
			}
			// add page with embed
			pm.addPage({ embeds: [embed] });
		});
		return pm;
	}

	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand(
			{
				name: this.name,
				description: this.description,
				options: [
					{
						name: 'query',
						description: 'the song to search for',
						type: 'STRING',
						required: false
					},
					{
						name: 'playlist',
						description: 'wether to search for a playlist instead of a song',
						type: 'BOOLEAN',
						required: false
					}
				]
			},
			{
				guildIds: getGuildIds(),
				idHints: ['952242234537963570']
			}
		);
	}
}
