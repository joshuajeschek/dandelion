import { ApplyOptions } from '@sapphire/decorators';
import { Command, CommandOptions, container } from '@sapphire/framework';
import { send } from '@sapphire/plugin-editable-commands';
import type { CommandInteraction, Message } from 'discord.js';
import { getGuildIds } from '../../lib/utils';

@ApplyOptions<CommandOptions>({
	description: 'Get the bot\'s ping',
	chatInputCommand: {
		register: true,
		guildIds: getGuildIds(),
	}
})
export class PingCommand extends Command {
	public async messageRun(message: Message) {
		const reply = await send(message, 'Ping?');
		return send(message, calculateResponse(message, reply));
	}
	public async chatInputRun(interaction: CommandInteraction) {
		const reply = await interaction.reply({content: 'Ping?', fetchReply: true}) as Message;
		return interaction.editReply(calculateResponse(interaction, reply));
	}
}

function calculateResponse(message: Message | CommandInteraction, reply: Message): string {
	return `Pong! Bot Latency ${Math.round(container.client.ws.ping)}ms. API Latency ${
		(reply.editedTimestamp || reply.createdTimestamp) - (message.createdTimestamp)
		}ms.`;
}
