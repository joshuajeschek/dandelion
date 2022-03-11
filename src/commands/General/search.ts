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
import dedent from 'dedent-js';
import { getGuildIds } from '../../lib/env-parser';

@ApplyOptions<CommandOptions>({
	description: 'Search for a song on youtube',
	options: ['query'],
	chatInputCommand: {
		register: true,
		guildIds: getGuildIds()
	}
})
export class SearchCommand extends Command {
	public async messageRun(message: Message, args: Args) {
		const songs = await this.search(args.getOption('query') || undefined);
		const pm = await this.getResultMessage(songs, message);
		return pm.run(message);
	}

	public async chatInputRun(interaction: CommandInteraction) {
		const songs = await this.search(interaction.options.getString('query') || undefined);
		const pm = await this.getResultMessage(songs, interaction);
		return pm.run(interaction);
	}

	private async search(query?: string): Promise<Song[]> {
		query ||= 'Never gonna give you up';
		const filter = (await ytsr.getFilters(query)).get('Type')?.get('Video');
		const results = await ytsr(filter?.url || query, { limit: 10 });
		const songs = results.items
			.flatMap((r) => {
				if (r.type !== 'video') return [];
				if (r.isLive || r.isUpcoming) return [];
				return {
					title: r.title,
					id: r.id,
					url: r.url,
					uploadedAt: r.uploadedAt ?? undefined,
					views: r.views ?? undefined,
					description: r.description ?? undefined,
					duration: r.duration ?? undefined,
					thumbnail: r.bestThumbnail.url ?? undefined
				};
			})
			.filter((_, i) => i < 10);
		return songs;
	}

	private async addToQueue(
		interaction: ButtonInteraction | SelectMenuInteraction,
		collector: InteractionCollector<MessageComponentInteraction>,
		handler: PaginatedMessage,
		songs: Song[],
		guildId?: string | null
	) {
		if (!guildId || !interaction.channel || !interaction.member || !('voice' in interaction.member)) return;
		if (!(await this.container.bard.canModifyPlayback(interaction.member as GuildMember))) {
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

		this.container.bard.addToQueue(guildId, songs[handler.index]);
		if (newConnection) this.container.bard.play(guildId);
		collector.stop();
		if ('edit' in interaction.message && interaction.message.editable) {
			interaction.message.edit(`${interaction.user} chose this song:`);
		}
		this.container.bard.sendNewJukeBox(guildId, interaction.channel, 'Added new song to queue');
		return;
	}

	private async getResultMessage(songs: Song[], ctx: CommandInteraction | Message): Promise<PaginatedMessage> {
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
			run: ({ interaction, collector, handler }) => this.addToQueue(interaction, collector, handler, songs, ctx.guildId)
		});

		// PAGES
		songs.forEach((s) => {
			const embed = new MessageEmbed({
				title: s.title,
				url: s.url,
				description: s.description
			});
			if (s.thumbnail) embed.setImage(s.thumbnail);
			if (s.uploadedAt) embed.addField('uploaded:', s.uploadedAt, true);
			if (s.views) embed.addField('views:', `${s.views}`, true);
			if (s.duration) embed.addField('duration:', s.duration, true);

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
					}
				]
			},
			{
				guildIds: getGuildIds()
			}
		);
	}
}
