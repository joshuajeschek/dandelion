import { Precondition } from '@sapphire/framework';
import type { CommandInteraction, ContextMenuInteraction, Message } from 'discord.js';
import { getOwnerIds } from '../lib/env-parser';

export class UserPrecondition extends Precondition {
	public async messageRun(message: Message) {
		return getOwnerIds().includes(message.author.id) ? this.ok() : this.error({ message: 'This command can only be used by the owner.' });
	}
	public async chatInputRun(interaction: CommandInteraction) {
		return getOwnerIds().includes(interaction.user.id) ? this.ok() : this.error({ message: 'This command can only be used by the owner.' });
	}
	public async contextMenuRun(interaction: ContextMenuInteraction) {
		return getOwnerIds().includes(interaction.user.id) ? this.ok() : this.error({ message: 'This command can only be used by the owner.' });
	}
}

declare module '@sapphire/framework' {
	interface Preconditions {
		OwnerOnly: never;
	}
}
