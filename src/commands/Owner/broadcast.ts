import { ApplyOptions } from '@sapphire/decorators';
import { MessagePrompter } from '@sapphire/discord.js-utilities';
import { fetch, FetchResultTypes } from '@sapphire/fetch';
import { ApplicationCommandRegistry, Command, CommandOptions } from '@sapphire/framework';
import { CommandInteraction, Message, MessageAttachment, MessageEmbed, MessageEmbedOptions, MessageOptions } from 'discord.js';
import { getOwnerGuildIds } from '../../lib/env-parser';

@ApplyOptions<CommandOptions>({
	description: 'Broadcast a message to newsletter subscribers',
	preconditions: ['OwnerOnly']
})
export class BroadcastCommand extends Command {
	public async chatInputRun(interaction: CommandInteraction) {
		const newsletter: MessageOptions = { content: interaction.options.getString('content', true) };

		const reply = (await interaction.reply({ content: '...', fetchReply: true })) as Message;

		if (interaction.options.getBoolean('embed', true)) {
			if (!interaction.channel) {
				return interaction.editReply('❌ An error occured.');
			}
			const embedPrompter = new MessagePrompter('Please upload a JSON file with embed data.', 'message', {
				timeout: 5 * 60 * 1000,
				editMessage: reply
			});
			const result = await embedPrompter.run(interaction.channel, interaction.user);
			if (!('attachments' in result) || result.attachments.size !== 1) {
				return interaction.followUp('❌ Please provide 1 JSON file!');
			}
			const embed = await this.getEmbedFromAttachment(result.attachments.first());
			if (!embed) return interaction.followUp('❌ Please provide a valid JSON file!');
			newsletter.embeds = [embed];
		}

		let msg = '❌ An error occured.';
		if (await this.broadcast(newsletter)) {
			msg = '✅ Newsletter broadcasted';
		}

		return newsletter.embeds ? interaction.followUp(msg) : interaction.editReply(msg);
	}

	// broadcasts message to everyone who has 'wantsNew
	private async broadcast(options: MessageOptions): Promise<Boolean> {
		const adressees = (
			await this.container.db.user.findMany({
				select: { id: true },
				where: { wantsNewsletter: true }
			})
		).map((u) => u.id);

		try {
			adressees.forEach((adressee) => {
				if (!this.container.client.users.cache.has(adressee)) this.container.client.users.fetch(adressee);
				this.container.client.users.createDM(adressee).then((c) => c.send(options));
			});
		} catch (error) {
			return false;
		}

		return true;
	}

	private async getEmbedFromAttachment(attachment?: MessageAttachment): Promise<MessageEmbed | null> {
		if (!attachment) return null;
		if (!attachment.contentType?.startsWith('application/json')) return null;
		try {
			const embed = (await fetch(attachment.url, FetchResultTypes.JSON)) as MessageEmbedOptions;
			return new MessageEmbed(embed);
		} catch {
			return null;
		}
	}

	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand(
			{
				name: this.name,
				description: this.description,
				options: [
					{
						name: 'content',
						description: 'the content to send',
						type: 'STRING',
						required: true
					},
					{
						name: 'embed',
						description: 'wether to wait for an embed',
						type: 'BOOLEAN',
						required: true
					}
				]
			},
			{
				guildIds: getOwnerGuildIds(),
				idHints: ['952242318621167737']
			}
		);
	}
}
