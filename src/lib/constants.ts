import { join } from 'path';
import { envParseArray } from './env-parser';

export const rootDir = join(__dirname, '..', '..');
export const srcDir = join(rootDir, 'src');

export const RandomLoadingMessage = ['Computing...', 'Thinking...', 'Cooking some food', 'Give me a moment', 'Loading...'];

/**
 * guildIds used for development, parsed from .env file
 */
export const guildIds = envParseArray('GUILDIDS', []);
