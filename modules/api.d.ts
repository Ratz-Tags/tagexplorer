export interface ArtistCountOptions {
  force?: boolean;
}

export function getArtistImageCount(artistName: string, options?: ArtistCountOptions): Promise<number>;
