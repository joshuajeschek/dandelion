import { send } from '@sapphire/plugin-editable-commands';
import { CommandInteraction, InteractionReplyOptions, Message, MessageComponentInteraction, MessageEmbed, MessagePayload } from 'discord.js';
import { RandomLoadingMessage } from './constants';

/**
 * Picks a random item from an array
 * @param array The array to pick a random item from
 * @example
 * const randomEntry = pickRandom([1, 2, 3, 4]) // 1
 */
export function pickRandom<T>(array: readonly T[]): T {
	const { length } = array;
	return array[Math.floor(Math.random() * length)];
}

/**
 * Sends a loading message to the current channel
 * @param message The message data for which to send the loading message
 */
export function sendLoadingMessage(message: Message): Promise<typeof message> {
	return send(message, { embeds: [new MessageEmbed().setDescription(pickRandom(RandomLoadingMessage)).setColor('#FF0000')] });
}

export function interactionReplyOrFollowUp(
	interaction: CommandInteraction | MessageComponentInteraction,
	options: string | MessagePayload | InteractionReplyOptions
) {
	if (interaction.replied) return interaction.followUp(options);
	return interaction.reply(options);
}

/**
 * formats a milliseconds input to the format "W days X hours Y minutes Z seconds"
 * @param milliseconds uptime of the bot
 * @returns nicely formatted time information
 */
export function millisecondsToTime(milliseconds: number | null): string {
	if (milliseconds === null) {
		return 'N/A';
	}
	const seconds = Math.round((milliseconds / 1000) % 60);
	const minutes = Math.round((milliseconds / (1000 * 60)) % 60);
	const hours = Math.round((milliseconds / (1000 * 60 * 60)) % 24);
	const days = Math.round((milliseconds / (1000 * 60 * 60 * 24)) % 60);

	if (seconds + minutes + hours + days === 0) {
		return 'N/A';
	}

	return (
		`${days != 0 ? `${days} ${days === 1 ? 'day' : 'days'}, ` : ''}` +
		`${hours != 0 ? `${hours} ${hours === 1 ? 'hour' : 'hours'}, ` : ''}` +
		`${minutes != 0 ? `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}, ` : ''}` +
		`${seconds != 0 ? `${seconds} ${seconds === 1 ? 'second' : 'seconds'}` : ''}`
	);
}
