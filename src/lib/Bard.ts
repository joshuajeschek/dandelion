import { AudioPlayer, AudioPlayerStatus, createAudioResource, joinVoiceChannel, NoSubscriberBehavior } from '@discordjs/voice';
import type { Container } from '@sapphire/pieces';
import {
	GuildMember,
	Message,
	MessageActionRow,
	MessageButton,
	MessageEmbed,
	MessageOptions,
	TextBasedChannel,
	TextChannel,
	VoiceChannel
} from 'discord.js';
import play from 'play-dl';
import jukebox from './resources/jukebox.json';

export class Bard {
	public readonly container;
	public readonly queue: Map<string, Song[]>;
	private readonly players: Map<string, AudioPlayer>;
	private readonly jukebox: Map<string, Message>;

	constructor(container: Container) {
		this.container = container;
		this.queue = new Map();
		this.players = new Map();
		this.jukebox = new Map();
	}

	public isConnected(guildId: string): boolean {
		return !!this.players.get(guildId);
	}

	public isPaused(guildId: string, audioPlayer?: AudioPlayer): boolean {
		audioPlayer ||= this.players.get(guildId);
		return audioPlayer?.state.status === AudioPlayerStatus.AutoPaused || audioPlayer?.state.status === AudioPlayerStatus.Paused;
	}

	public async updateActivityConcurrently(interval?: number) {
		interval ||= 10_000;
		let checkedGuilds: string[] = [];
		while (true) {
			await new Promise((r) => setTimeout(r, interval));
			if (this.queue.size === 0 && checkedGuilds.at(-1)) {
				this.container.client.user?.setActivity({
					type: 'LISTENING',
					name: 'nothing 🙁'
				});
				checkedGuilds = [];
				continue;
			}
			if (checkedGuilds.length === this.queue.size) checkedGuilds = [];
			for (const [guildId, songs] of this.queue) {
				if (guildId in checkedGuilds) continue;
				checkedGuilds.push(guildId);
				this.container.client.user?.setActivity({
					type: 'LISTENING',
					name: songs[0].title,
					url: songs[0].url
				});
				break;
			}
		}
	}

	public async canModifyPlayback(member: GuildMember) {
		if (!this.container.client.guilds.cache.has(member.guild.id))
			await this.container.client.guilds.fetch({ guild: member.guild.id, force: true });
		const guild = await this.container.client.guilds.fetch(member.guild.id);
		return (
			member.voice.channel?.type === 'GUILD_VOICE' &&
			member.voice.channel?.permissionsFor(member).has('SPEAK') &&
			(!this.isConnected(guild.id) || guild.me?.voice.channelId === member.voice.channelId)
		);
	}

	public addToQueue(guildId: string, song: Song) {
		this.container.logger.info(`queue[${guildId}] - ${song.title}`);
		if (!this.players.get(guildId)) return;
		if (!this.queue.get(guildId)) this.queue.set(guildId, []);
		this.queue.get(guildId)?.push(song);
	}

	public async play(guildId: string) {
		this.container.logger.info(`play[${guildId}]`);
		const audioPlayer = this.players.get(guildId);
		if (!audioPlayer) return;
		if (this.isPaused(guildId, audioPlayer)) return audioPlayer.unpause();
		const song = this.queue.get(guildId)?.at(0);
		if (!song) return this.disconnect(guildId);
		const source = await play.stream(song.url);
		audioPlayer.play(createAudioResource(source.stream, { inputType: source.type }));
	}

	public pause(guildId: string) {
		this.container.logger.info(`pause[${guildId}]`);
		const audioPlayer = this.players.get(guildId);
		if (!audioPlayer) return;
		audioPlayer.pause();
	}

	public async skip(guildId: string, channel?: TextBasedChannel, content?: string) {
		this.container.logger.info(`skip[${guildId}]`);
		if (!this.queue.get(guildId)) return;
		this.queue.get(guildId)?.shift();
		channel ||= this.jukebox.get(guildId)?.channel as TextChannel;
		await this.play(guildId);
		if (channel) this.sendNewJukeBox(guildId, channel, content);
	}

	public connect(channel: VoiceChannel): boolean {
		this.container.logger.info(`connect${channel.guildId}`);
		if (this.isConnected(channel.guildId)) return false;
		const connection = joinVoiceChannel({
			channelId: channel.id,
			guildId: channel.guildId,
			adapterCreator: channel.guild.voiceAdapterCreator
		});
		const audioPlayer = new AudioPlayer({
			behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
		});
		audioPlayer.on('unsubscribe', () => this.disconnect(channel.guildId));
		audioPlayer.on('error', () => this.disconnect(channel.guildId));
		audioPlayer.on<'stateChange'>('stateChange', (_, n) => {
			if (n.status === 'idle') this.skip(channel.guildId);
		});
		connection.subscribe(audioPlayer);
		this.players.set(channel.guildId, audioPlayer);
		return true;
	}

	public disconnect(guildId: string) {
		this.container.logger.info(`disconnect[${guildId}]`);
		this.players.get(guildId)?.stop();
		this.queue.delete(guildId);
		this.players.delete(guildId);
	}

	public async sendNewJukeBox(guildId: string, channel: TextBasedChannel, content?: string) {
		this.jukebox.get(guildId)?.delete();
		const jukebox = this.getJukebox(guildId);
		jukebox.content ||= content;
		this.jukebox.set(guildId, await channel.send(jukebox));
	}

	public getJukebox(guildId: string): MessageOptions {
		this.container.logger.info(`getJukebox[${guildId}]`);
		if (!this.players.get(guildId))
			return {
				content: 'I am currently not playing something, use `search` to find a song and add it to the queue!'
			};

		const currentSong = this.queue.get(guildId)?.at(0);

		const dsc =
			`${currentSong?.description ? `${currentSong.description}\n` : ''}` +
			`${currentSong?.duration ? `duration: ${currentSong.duration}` : ''}`;

		const embed = new MessageEmbed(jukebox).setDescription(dsc);
		if (currentSong?.title) embed.setTitle(currentSong.title);
		if (currentSong?.url) embed.setURL(currentSong.url);
		if (currentSong?.thumbnail) embed.setImage(currentSong.thumbnail);

		this.queue.get(guildId)?.forEach((song, i) => {
			if (i === 0) return;
			embed.addField(i === 1 ? 'Up Next' : `${i}.`, song.title, true);
		});

		const paused = this.isPaused(guildId);

		const playPauseButton = new MessageButton()
			.setCustomId('bard/play-pause')
			.setEmoji(paused ? '▶️' : '⏸️')
			.setLabel(paused ? 'play' : 'pause')
			.setStyle('PRIMARY');
		const skipButton = new MessageButton().setCustomId('bard/skip').setEmoji('⏭️').setLabel('skip').setStyle('SECONDARY');

		const row = new MessageActionRow().addComponents(playPauseButton, skipButton);

		return { content: undefined, embeds: [embed], components: [row] };
	}
}
