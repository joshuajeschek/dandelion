import { ApplyOptions } from '@sapphire/decorators';
import { ApplicationCommandRegistry, Args, Command, CommandOptions } from '@sapphire/framework';
import { send } from '@sapphire/plugin-editable-commands';
import { inlineCodeBlock } from '@sapphire/utilities';
import { CommandInteraction, Message, Permissions } from 'discord.js';
import { getGuildIds } from '../../lib/env-parser';

@ApplyOptions<CommandOptions>({
	description: 'Set the bots prefix in this guild',
	chatInputCommand: {
		register: true,
		guildIds: getGuildIds()
	},
	preconditions: ['GuildOnly'],
	options: ['prefix']
})
export class PrefixCommand extends Command {
	public async messageRun(message: Message, args: Args) {
		const arg = message.member?.permissions.has('ADMINISTRATOR') ? args.nextMaybe() : { value: undefined };
		return send(message, await this.setPrefix(message, arg.value));
	}
	public async chatInputRun(interaction: CommandInteraction) {
		const member = interaction.member;
		const arg =
			member?.permissions instanceof Permissions && member.permissions.has('ADMINISTRATOR')
				? interaction.options.getString('prefix') || undefined
				: undefined;
		return interaction.reply(await this.setPrefix(interaction, arg));
	}

	private async setPrefix(ctx: Message | CommandInteraction, arg?: string): Promise<string> {
		if (!ctx.guildId) return 'Please only use this in a guild!';
		// query the prefix
		if (!arg) {
			const { prefix } = (await this.container.db.guild.findFirst({
				where: { id: ctx.guildId },
				select: { prefix: true }
			})) || { prefix: this.container.client.options.defaultPrefix };

			if (!prefix) return 'There is currently no prefix set.';
			return `The prefix is currently ${inlineCodeBlock(prefix.toString())}.`;
		}
		// change the prefix
		const { prefix } = await this.container.db.guild.upsert({
			create: { id: ctx.guildId, prefix: arg },
			update: { prefix: arg },
			where: { id: ctx.guildId }
		});
		return `Prefix now set to ${inlineCodeBlock(prefix)}.`;
	}

	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand(
			{
				name: this.name,
				description: this.description,
				options: [
					{
						name: 'prefix',
						description: 'the code to evaluate',
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
