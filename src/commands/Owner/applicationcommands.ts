import { ApplyOptions } from '@sapphire/decorators';
import { PaginatedMessage } from '@sapphire/discord.js-utilities';
import { ApplicationCommandRegistry, Command, CommandOptions } from '@sapphire/framework';
import { codeBlock, deepClone } from '@sapphire/utilities';
import {
	ApplicationCommand,
	AutocompleteInteraction,
	CommandInteraction,
	Message,
	MessageActionRow,
	MessageButton,
	MessageComponentInteraction,
	MessageEmbed
} from 'discord.js';
import { getOwnerGuildIds } from '../../lib/env-parser';
import { getAccentColor } from '../../lib/utils';

@ApplyOptions<CommandOptions>({
	description: 'Inspect and Cherry Pick installed commands',
	preconditions: ['OwnerOnly']
})
export class ApplicationCommandsCommand extends Command {
	public async chatInputRun(interaction: CommandInteraction) {
		const guildId = interaction.options.getString('guild-id', false) ?? undefined;
		const manager = guildId ? (await this.container.client.guilds.fetch(guildId)).commands : this.container.client.application?.commands;
		if (!manager) return interaction.reply('No manager found!');
		const commands = (await manager.fetch({ force: true })).map((command) => command);
		if (commands.length === 0) return interaction.reply('No application commands found!');
		const paginatedMessage = await (await this.getList(commands)).run(interaction);
		if (!paginatedMessage.response || !(paginatedMessage.response instanceof Message)) return interaction.followUp('Oops, something went wrong.');

		// TODO upgrade this to .from-syntax in discord.js v14
		const components = deepClone(paginatedMessage.response.components);
		components.push(
			new MessageActionRow().addComponents(
				new MessageButton().setCustomId('commands/applicationcommands/delete').setEmoji('🗑️').setLabel('abort search').setStyle('DANGER')
			)
		);
		const message = await paginatedMessage.response.edit({ components });

		const filter = (id: string) => (i: MessageComponentInteraction) => i.customId === id && i.user.id === interaction.user.id;

		message
			.createMessageComponentCollector({
				filter: filter('commands/applicationcommands/delete')
			})
			.on('collect', async (i) => {
				const toDelete = commands.at(paginatedMessage.index);
				let error: string | undefined;
				if (toDelete) await manager.delete(toDelete).catch((e) => (error = e.message || 'unknown error'));
				i.reply(
					!error && toDelete
						? `Deleted command ${toDelete.name} [${toDelete.id}].`
						: `An error occured while deleting the command: ${codeBlock('console', error?.slice(0, 800))}`
				);
			});
	}

	public async autocompleteRun(interaction: AutocompleteInteraction) {
		const options = (await this.container.client.guilds.fetch()).map((guild) => ({ name: `${guild.name} [${guild.id}]`, value: guild.id }));
		if (!options) return interaction.respond([]);
		interaction.respond(options);
	}

	private async getList(commands: ApplicationCommand[]) {
		const pm = new PaginatedMessage({ template: { content: 'Following application commands have been detected:' } });
		pm.actions.delete('@sapphire/paginated-messages.firstPage');
		pm.actions.delete('@sapphire/paginated-messages.goToLastPage');
		const accentColor = await getAccentColor();
		pm.addPages(commands.map((command) => ({ embeds: [this.commandToEmbed(command, accentColor)] })));
		pm.setSelectMenuOptions((pageIndex) => {
			return {
				label: commands.at(pageIndex - 1)?.name || `${pageIndex}`,
				description: commands.at(pageIndex - 1)?.description || undefined
			};
		});

		return pm;
	}

	private commandToEmbed(command: ApplicationCommand, accentColor: number) {
		return new MessageEmbed()
			.setTitle(command.name)
			.setDescription(command.description)
			.setColor(accentColor)
			.addField('id', command.id)
			.addField('options', command.options.map((o) => `${o.name}: ${o.type}`).join('\n') || '/');
	}

	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand(
			(b) =>
				b
					.setName(this.name)
					.setDescription(this.description)
					.addStringOption((o) => o.setName('guild-id').setDescription('guild id for chat input guild commands').setAutocomplete(true)),
			{ guildIds: getOwnerGuildIds(), idHints: ['958855217498193960'] }
		);
	}
}
