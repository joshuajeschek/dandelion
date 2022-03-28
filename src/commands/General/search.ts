import { ApplyOptions } from '@sapphire/decorators';
import { ApplicationCommandRegistry, Command, CommandOptions } from '@sapphire/framework';
import type { CommandInteraction, Message } from 'discord.js';
import { getGuildIds } from '../../lib/env-parser';
import { RecordStore } from '../../lib/RecordStore';

@ApplyOptions<CommandOptions>({
	description: 'Search for a song on youtube',
	options: ['query', 'url', 'playlist']
})
export class SearchCommand extends Command {
	public async messageRun(message: Message) {
		message.reply('This is currently not implemented');
	}

	public async chatInputRun(interaction: CommandInteraction) {
		interaction.deferReply();
		const url = interaction.options.getString('url');
		// default query only if no url is given
		const query = interaction.options.getString('query') || (!url ? 'Never gonna give you up' : undefined);
		const playlist = interaction.options.getBoolean('playlist') || undefined;

		const items: (Song | Playlist)[] = [];
		if (url) items.push(...(await RecordStore.getInformation(url, 1)));
		if (query) items.push(...(await RecordStore.getInformation(query, 10, playlist ? 'playlist' : 'video')));

		if (items.length === 0) return interaction.reply({ content: 'Could not find anything matching your request', ephemeral: true });

		// also handles offer acceptance
		RecordStore.makeOffer(items, interaction);
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
						name: 'url',
						description: 'URL of the song / playlist you want to play',
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
