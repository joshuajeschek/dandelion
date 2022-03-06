import { isNullishOrEmpty } from '@sapphire/utilities';

let guildIds: string[];

export function envParseArray(key: 'OWNERS' | 'GUILDIDS', defaultValue?: string[]): string[] {
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
