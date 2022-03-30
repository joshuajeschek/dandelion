import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, ListenerOptions } from '@sapphire/framework';
import type { APIMessage } from 'discord-api-types';
import { Interaction, Message, MessageActionRow } from 'discord.js';
import { getOwnerIds } from '../../../lib/env-parser';

@ApplyOptions<ListenerOptions>({
	event: Events.InteractionCreate
})
export class UserEvent extends Listener<typeof Events.InteractionCreate> {
	// map for all guilds, containing sets of user id -> this way a user can only press skip once
	skips = new Map<string, Set<string>>();

	public async run(interaction: Interaction) {
		if (!interaction.isButton() || interaction.customId !== 'bard/skip' || !interaction.guildId || !interaction.channel) return;
		if (!this.container.bard.isConnected(interaction.guildId)) return;

		const { skiplimit } = (await this.container.db.guild.findFirst({ select: { skiplimit: true }, where: { id: interaction.guildId } })) ?? {
			skiplimit: 1
		};

		// we don't handle if permissions has API format (string) -> just skip in that case
		// shouldn't happen too often 🤞
		// if only admin can skip and it is invoked by admin
		const adminskip =
			skiplimit < 0 &&
			(typeof interaction.member?.permissions === 'string' ||
				interaction.member?.permissions.has('MANAGE_GUILD') ||
				getOwnerIds().includes(interaction.user.id));

		// wether single person can skip
		const singleskip = skiplimit === 1 || skiplimit === 0;
		if (adminskip || singleskip) {
			return this.container.bard.skip(interaction.guildId, interaction.channel, 'Skipped a song');
		} else if (skiplimit < 0) {
			// not pressed by admin
			return interaction.reply({ content: 'Only admins can skip songs :/', ephemeral: true });
		}

		// if set doesn't exist, create new set
		if (!this.skips.has(interaction.guildId)) this.skips.set(interaction.guildId, new Set());
		// add current user id to set
		this.skips.get(interaction.guildId)?.add(interaction.user.id);

		const currentSkips = this.skips.get(interaction.guildId)?.size ?? 1;

		// TODO: maybe this could also be done via interaction.update()
		if (currentSkips >= skiplimit) {
			await this.container.bard.skip(interaction.guildId, interaction.channel, 'Skipped a song');
			await this.setSkipButton(interaction.message);
			this.skips.delete(interaction.guildId);
		} else {
			await interaction.deferUpdate();
			await this.setSkipButton(interaction.message, `skip (${currentSkips}/${skiplimit})`);
		}
	}

	private async setSkipButton(message: Message | APIMessage, content?: string) {
		if ('edit' in message) {
			const newComponents = message.components.map((row) => {
				return new MessageActionRow().addComponents(
					row.components.map((c) => {
						if (c.type === 'BUTTON' && c.customId === 'bard/skip') {
							c.setLabel(content ?? 'skip');
						}
						return c;
					})
				);
			});
			await message.edit({ components: newComponents });
		}
	}
}
