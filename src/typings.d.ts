interface Song {
	title: string;
	id: string;
	url: string;
	author?: string;
	uploadedAt?: string;
	views?: number;
	description?: string;
	duration?: string;
	thumbnail?: string;
}

type Playlist = {
	title: string;
	id: string;
	url: string;
	author?: string;
	estimatedItemCount: number;
	description?: string;
	thumbnail?: string;
	views?: number;
	songs: Song[];
};
