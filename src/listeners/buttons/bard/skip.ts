import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, ListenerOptions } from '@sapphire/framework';
import type { Interaction } from 'discord.js';

@ApplyOptions<ListenerOptions>({
	event: Events.InteractionCreate
})
export class UserEvent extends Listener<typeof Events.InteractionCreate> {
	public async run(interaction: Interaction) {
		if (!interaction.isButton() || interaction.customId !== 'bard/skip' || !interaction.guildId) return;
		if (!this.container.bard.isConnected(interaction.guildId)) return;
		this.container.bard.skip(interaction.guildId);

		interaction.reply({ content: 'skipped current song', ephemeral: true });
	}
}
