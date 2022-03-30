import { isNullishOrEmpty } from '@sapphire/utilities';

let guildIds: string[];
let ownerGuildIds: string[];
let owners: string[];

type envArrayKey = 'OWNERS' | 'GUILDIDS' | 'OWNER_GUILDIDS';

export function envParseArray(key: envArrayKey, defaultValue?: string[]): string[] {
	const value = process.env[key];
	if (isNullishOrEmpty(value)) {
		if (defaultValue === undefined) throw new Error(`[ENV] ${key} - The key must be an array, but is empty or undefined.`);
		return defaultValue;
	}

	return value.split(' ');
}

/**
 * Returns an array with the guild id(s) for which the chat input commands should be activated
 * @returns the array of guildIds
 */
export function getGuildIds() {
	guildIds ||= envParseArray('GUILDIDS', []);
	return guildIds;
}

/**
 * Returns an array with the guild id(s) for which the chat input commands should be activated
 * @returns the array of guildIds
 */
export function getOwnerGuildIds() {
	ownerGuildIds ||= envParseArray('OWNER_GUILDIDS', []);
	return ownerGuildIds;
}

/**
 * Returns an array with the owner id(s) of the bot
 * @returns the array of owner ids
 */
export function getOwnerIds() {
	owners ||= envParseArray('OWNERS', []);
	return owners;
}
