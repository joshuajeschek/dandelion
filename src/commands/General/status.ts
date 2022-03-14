import { ApplyOptions } from '@sapphire/decorators';
import { Command, CommandOptions } from '@sapphire/framework';
import { CommandInteraction, Message, MessageActionRow, MessageButton, MessageEmbed, MessageOptions } from 'discord.js';
import { getGuildIds } from '../../lib/env-parser';
import si from 'systeminformation';
import { version, homepage, bugs } from '../../../package.json';
import { millisecondsToTime } from '../../lib/utils';
import Vibrant from 'node-vibrant';

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
	private accentColor?: number;

	public async messageRun(message: Message) {
		return message.reply(await this.getStatusMessage());
	}
	public async chatInputRun(interaction: CommandInteraction) {
		return interaction.reply(await this.getStatusMessage());
	}

	private async getStatusMessage(): Promise<MessageOptions> {
		this.osInfo ||= await this.getOsInfo();
		this.accentColor ||= await this.getAccentColor();

		const ping = `${this.container.client.ws.ping ? `${Math.round(this.container.client.ws.ping)} ms` : 'N/A'}`;
		const embed = new MessageEmbed()
			.setTitle('Status')
			.setColor(this.accentColor)
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

	private async getAccentColor(): Promise<number> {
		// not necessary, since bot users currently always have accentColor=null
		// if (!this.container.client.user?.accentColor) await this.container.client.user?.fetch(true);
		// if (this.container.client.user?.accentColor) return this.container.client.user.accentColor;
		if (!this.container.client.user) return 3092790;
		const palette = await Vibrant.from(this.container.client.user.displayAvatarURL({ format: 'png' })).getPalette();
		return palette.Vibrant?.hex ? parseInt(palette.Vibrant?.hex.replaceAll(/[^0-9a-fA-f]/g, ''), 16) : 3092790;
	}

	private async getOsInfo() {
		const info = await si.osInfo();
		return `Platform: ${info.platform}
            Distribution: ${info.distro}
            Release: ${info.release}`;
	}
}
