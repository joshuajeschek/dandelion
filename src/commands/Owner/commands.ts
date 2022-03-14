import { ApplyOptions } from '@sapphire/decorators';
import { Args, Command, CommandOptions } from '@sapphire/framework';
import { codeBlock } from '@sapphire/utilities';
import type { Message } from 'discord.js';

@ApplyOptions<CommandOptions>({
	description: 'Broadcast a message to newsletter subscribers',
	preconditions: ['OwnerOnly'],
	options: ['mode', 'guildId']
})
export class Commandscommand extends Command {
	public async messageRun(message: Message, args: Args) {
		const mode = args.getOption('mode');
		const guildId = args.getOption('guildId');
		const manager = guildId ? (await this.container.client.guilds.fetch(guildId)).commands : this.container.client.application?.commands;
		if (mode === 'reset') await manager?.set([]).catch((err) => message.reply(codeBlock('console', JSON.stringify(err))));

		const output = JSON.stringify(manager?.cache, ['id', 'guild', 'type', 'name', 'description', 'options'], 4);

		if (output.length > 2000) {
			return message.reply({
				content: `Output was too long... sent the result as a file.`,
				files: [{ attachment: Buffer.from(output), name: 'output.json' }]
			});
		}

		return message.reply(output);
	}
}
