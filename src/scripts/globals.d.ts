/* eslint-disable @typescript-eslint/no-unused-vars */

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DANBOORU_CONCURRENCY?: string;
      DANBOORU_BASE_DELAY_MS?: string;
      PER_TAG_CONCURRENCY?: string;
      NEW_ARTIST_COUNT_CONCURRENCY?: string;
      MIN_ARTIST_POSTS?: string;
      REFRESH_ZERO_COUNTS?: string;
      ZERO_COUNT_CONCURRENCY?: string;
      REFRESH_COUNTS_CONCURRENCY?: string;
      REFRESH_ALL_COUNTS?: string;
    }
  }
}

export {};
