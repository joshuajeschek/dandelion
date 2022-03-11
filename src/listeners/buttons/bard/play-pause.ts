import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, ListenerOptions } from '@sapphire/framework';
import { Interaction, MessageActionRow } from 'discord.js';

@ApplyOptions<ListenerOptions>({
	event: Events.InteractionCreate
})
export class UserEvent extends Listener<typeof Events.InteractionCreate> {
	public async run(interaction: Interaction) {
		if (!interaction.isButton() || interaction.customId !== 'bard/play-pause' || !interaction.guildId) return;
		const paused = this.container.bard.isPaused(interaction.guildId);

		const message = interaction.message;

		if ('edit' in message) {
			const newComponents = message.components.map((row) => {
				return new MessageActionRow().addComponents(
					row.components.map((c) => {
						if (c.type === 'BUTTON' && c.customId === 'bard/play-pause') {
							c.setEmoji(paused ? '⏸️' : '▶️');
							c.setLabel(paused ? 'pause' : 'play');
						}
						return c;
					})
				);
			});
			message.edit({ components: newComponents });
		}

		paused ? this.container.bard.play(interaction.guildId) : this.container.bard.pause(interaction.guildId);
	}
}
