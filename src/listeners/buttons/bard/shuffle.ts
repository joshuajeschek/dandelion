import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, ListenerOptions } from '@sapphire/framework';
import type { APIMessage } from 'discord-api-types';
import { Interaction, Message, MessageActionRow } from 'discord.js';
import { getOwnerIds } from '../../../lib/env-parser';

@ApplyOptions<ListenerOptions>({
	event: Events.InteractionCreate
})
export class UserEvent extends Listener<typeof Events.InteractionCreate> {
	// map for all guilds, containing sets of user id -> this way a user can only press shuffle once
	shuffles = new Map<string, Set<string>>();

	public async run(interaction: Interaction) {
		if (!interaction.isButton() || interaction.customId !== 'bard/shuffle' || !interaction.guildId || !interaction.channel) return;
		if (!this.container.bard.isConnected(interaction.guildId)) return;

		const { shufflelimit } = (await this.container.db.guild.findFirst({
			select: { shufflelimit: true },
			where: { id: interaction.guildId }
		})) ?? {
			shufflelimit: 2
		};

		// we don't handle if permissions has API format (string) -> just shuffle in that case
		// shouldn't happen too often 🤞
		// if only admin can shuffle and it is invoked by admin
		const adminshuffle =
			shufflelimit < 0 &&
			(typeof interaction.member?.permissions === 'string' ||
				interaction.member?.permissions.has('MANAGE_GUILD') ||
				getOwnerIds().includes(interaction.user.id));

		// wether single person can shuffle
		const singleshuffle = shufflelimit === 1 || shufflelimit === 0;
		if (adminshuffle || singleshuffle) {
			return this.container.bard.shuffle(interaction.guildId, interaction.channel, 'Shuffled the queue');
		} else if (shufflelimit < 0) {
			// not pressed by admin
			return interaction.reply({ content: 'Only admins can shuffle songs :/', ephemeral: true });
		}

		// if set doesn't exist, create new set
		if (!this.shuffles.has(interaction.guildId)) this.shuffles.set(interaction.guildId, new Set());
		// add current user id to set
		this.shuffles.get(interaction.guildId)?.add(interaction.user.id);

		const currentShuffles = this.shuffles.get(interaction.guildId)?.size ?? 1;

		// TODO: maybe this could also be done via interaction.update()
		if (currentShuffles >= shufflelimit) {
			this.container.bard.shuffle(interaction.guildId, interaction.channel, 'Shuffled the queue');
			await this.setShuffleButton(interaction.message);
			this.shuffles.delete(interaction.guildId);
		} else {
			await interaction.deferUpdate();
			await this.setShuffleButton(interaction.message, `shuffle (${currentShuffles}/${shufflelimit})`);
		}
	}

	private async setShuffleButton(message: Message | APIMessage, content?: string) {
		if ('edit' in message) {
			const newComponents = message.components.map((row) => {
				return new MessageActionRow().addComponents(
					row.components.map((c) => {
						if (c.type === 'BUTTON' && c.customId === 'bard/shuffle') {
							c.setLabel(content ?? 'shuffle');
						}
						return c;
					})
				);
			});
			await message.edit({ components: newComponents });
		}
	}
}
