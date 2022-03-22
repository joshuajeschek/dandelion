import { ApplyOptions } from '@sapphire/decorators';
import { Command, CommandOptions } from '@sapphire/framework';
import { CommandInteraction, Message, MessageActionRow, MessageButton, MessageEmbed, MessageOptions } from 'discord.js';
import { getGuildIds } from '../../lib/env-parser';
import si from 'systeminformation';
import { version, homepage, bugs } from '../../../package.json';
import { getAccentColor, millisecondsToTime } from '../../lib/utils';

@ApplyOptions<CommandOptions>({
	description: "Get information about the bot's status",
	chatInputCommand: {
		register: true,
		guildIds: getGuildIds(),
		idHints: ['952242317505495051']
	}
})
export class StatusCommand extends Command {
	private osInfo?: string;

	public async messageRun(message: Message) {
		return message.reply(await this.getStatusMessage());
	}
	public async chatInputRun(interaction: CommandInteraction) {
		return interaction.reply(await this.getStatusMessage());
	}

	private async getStatusMessage(): Promise<MessageOptions> {
		this.osInfo ||= await this.getOsInfo();

		const ping = `${this.container.client.ws.ping ? `${Math.round(this.container.client.ws.ping)} ms` : 'N/A'}`;
		const embed = new MessageEmbed()
			.setTitle('Status')
			.setColor(await getAccentColor())
			.addField('ping: ', ping)
			.addField('uptime: ', millisecondsToTime(this.container.client.uptime))
			.addField('running on:', this.osInfo)
			.addField('bot version:', version);
		if (this.container.client.user) embed.setThumbnail(this.container.client.user.displayAvatarURL());

		const row = new MessageActionRow().addComponents(
			new MessageButton().setStyle('LINK').setLabel('GitHub').setURL(homepage).setEmoji('951055563607912449'),
			new MessageButton().setStyle('LINK').setLabel('Report Bugs and Request Features').setURL(bugs)
		);

		return { embeds: [embed], components: [row] };
	}

	private async getOsInfo() {
		const info = await si.osInfo();
		return `Platform: ${info.platform}
            Distribution: ${info.distro}
            Release: ${info.release}`;
	}
}
