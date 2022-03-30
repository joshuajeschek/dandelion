import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, ListenerOptions } from '@sapphire/framework';
import type { APIMessage } from 'discord-api-types';
import { Interaction, Message, MessageActionRow } from 'discord.js';
import { getOwnerIds } from '../../../lib/env-parser';

@ApplyOptions<ListenerOptions>({
	event: Events.InteractionCreate
})
export class UserEvent extends Listener<typeof Events.InteractionCreate> {
	// map for all guilds, containing sets of user id -> this way a user can only press stop once
	stops = new Map<string, Set<string>>();

	public async run(interaction: Interaction) {
		if (!interaction.isButton() || interaction.customId !== 'bard/stop' || !interaction.guildId || !interaction.channel) return;
		if (!this.container.bard.isConnected(interaction.guildId)) return;

		const { stoplimit } = (await this.container.db.guild.findFirst({ select: { stoplimit: true }, where: { id: interaction.guildId } })) ?? {
			stoplimit: 1
		};

		// we don't handle if permissions has API format (string) -> just stop in that case
		// shouldn't happen too often 🤞
		// if only admin can stop and it is invoked by admin
		const adminstop =
			stoplimit < 0 &&
			(typeof interaction.member?.permissions === 'string' ||
				interaction.member?.permissions.has('MANAGE_GUILD') ||
				getOwnerIds().includes(interaction.user.id));

		// wether single person can stop
		const singlestop = stoplimit === 1 || stoplimit === 0;
		if (adminstop || singlestop) {
			return this.container.bard.stop(interaction.guildId, interaction.channel, 'Stopped playback and cleared the queue');
		} else if (stoplimit < 0) {
			// not pressed by admin
			return interaction.reply({ content: 'Only admins can stop playback :/', ephemeral: true });
		}

		// if set doesn't exist, create new set
		if (!this.stops.has(interaction.guildId)) this.stops.set(interaction.guildId, new Set());
		// add current user id to set
		this.stops.get(interaction.guildId)?.add(interaction.user.id);

		const currentStops = this.stops.get(interaction.guildId)?.size ?? 1;

		// TODO: maybe this could also be done via interaction.update()
		if (currentStops >= stoplimit) {
			this.container.bard.stop(interaction.guildId, interaction.channel, 'Stopped playback and cleared the queue');
			await this.setStopButton(interaction.message);
			this.stops.delete(interaction.guildId);
		} else {
			await interaction.deferUpdate();
			await this.setStopButton(interaction.message, `stop (${currentStops}/${stoplimit})`);
		}
	}

	private async setStopButton(message: Message | APIMessage, content?: string) {
		if ('edit' in message) {
			const newComponents = message.components.map((row) => {
				return new MessageActionRow().addComponents(
					row.components.map((c) => {
						if (c.type === 'BUTTON' && c.customId === 'bard/stop') {
							c.setLabel(content ?? 'stop');
						}
						return c;
					})
				);
			});
			await message.edit({ components: newComponents });
		}
	}
}
