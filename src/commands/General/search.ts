import { ApplyOptions } from '@sapphire/decorators';
import { PaginatedMessage } from '@sapphire/discord.js-utilities';
import { ApplicationCommandRegistry, Args, Command, CommandOptions } from '@sapphire/framework';
import { CommandInteraction, Message, MessageEmbed } from 'discord.js';
import ytsr from 'ytsr';
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
		const pm = await this.getResultMessage(songs);
		return pm.run(message);
	}

	public async chatInputRun(interaction: CommandInteraction) {
		const songs = await this.search(interaction.options.getString('query') || undefined);
		const pm = await this.getResultMessage(songs);
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

	private async getResultMessage(songs: Song[]): Promise<PaginatedMessage> {
		const pm = new PaginatedMessage({
			template: { content: 'Please navigate using the arrow buttons and make a selection.' }
		});

		// ACTIONS
		pm.actions.delete('@sapphire/paginated-messages.firstPage');
		pm.actions.delete('@sapphire/paginated-messages.goToLastPage');
		pm.addAction({
			type: 2,
			label: 'add to queue',
			style: 'SUCCESS',
			customId: 'queue',
			emoji: '➕',
			run: () => {
				console.log('ADD TO QUEUE');
			}
		});
		const stopAction = pm.actions.get('@sapphire/paginated-messages.stop');
		if (stopAction && stopAction.type === 2) {
			stopAction.label = 'abort search';
			stopAction.emoji = '🗑️';
		}

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
