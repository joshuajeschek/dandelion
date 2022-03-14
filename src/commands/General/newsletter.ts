import { ApplyOptions } from '@sapphire/decorators';
import { ApplicationCommandRegistry, Command, CommandOptions } from '@sapphire/framework';
import { CommandInteraction, Message, MessageActionRow, MessageButton } from 'discord.js';
import { getGuildIds } from '../../lib/env-parser';

@ApplyOptions<CommandOptions>({
	description: 'Subscribe / Unsubscribe from the newsletter',
	chatInputCommand: {
		register: true,
		guildIds: getGuildIds(),
		idHints: ['952242232163971072']
	}
})
export class NewsletterCommand extends Command {
	public async messageRun(message: Message) {
		return this.sendReply(message);
	}
	public async chatInputRun(interaction: CommandInteraction) {
		return this.sendReply(interaction);
	}

	private sendReply(ctx: Message | CommandInteraction) {
		const row = new MessageActionRow().addComponents(
			new MessageButton().setCustomId('newsletterSubscribe').setLabel('Subscribe').setStyle('SUCCESS'),
			new MessageButton().setCustomId('newsletterUnsubscribe').setLabel('Unsubscribe').setStyle('DANGER')
		);
		return ctx.reply({
			content: 'By subscribing to the bot newsletter, you will get notified of new features and updates!',
			components: [row]
		});
	}

	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description
		});
	}
}
