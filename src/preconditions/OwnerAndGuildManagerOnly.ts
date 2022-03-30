import { Precondition } from '@sapphire/framework';
import type { CommandInteraction, ContextMenuInteraction, Message } from 'discord.js';
import { getOwnerIds } from '../lib/env-parser';

export class UserPrecondition extends Precondition {
	public async messageRun(message: Message) {
		const member = message.member;
		if (!member) return this.error({ message: 'This command can only be used in guilds' });
		return getOwnerIds().includes(message.author.id) || member.permissions.has('MANAGE_GUILD')
			? this.ok()
			: this.error({ message: 'This command can only be used by guild members who can manage the guild' });
	}
	public async chatInputRun(interaction: CommandInteraction) {
		const member = interaction.member;
		if (!member) return this.error({ message: 'This command can only be used in guilds' });
		if (typeof member.permissions === 'string') return this.error({ message: 'There was an error parsing your permissions' });
		return getOwnerIds().includes(interaction.user.id) || member.permissions.has('MANAGE_GUILD')
			? this.ok()
			: this.error({ message: 'This command can only be used by guild members who can manage the guild' });
	}
	public async contextMenuRun(interaction: ContextMenuInteraction) {
		const member = interaction.member;
		if (!member) return this.error({ message: 'This command can only be used in guilds' });
		if (typeof member.permissions === 'string') return this.error({ message: 'There was an error parsing your permissions' });
		return getOwnerIds().includes(interaction.user.id) || member.permissions.has('MANAGE_GUILD')
			? this.ok()
			: this.error({ message: 'This command can only be used by guild members who can manage the guild' });
	}
}

declare module '@sapphire/framework' {
	interface Preconditions {
		OwnerAndGuildManagerOnly: never;
	}
}
