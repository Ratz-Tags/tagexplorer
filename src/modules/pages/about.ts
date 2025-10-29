import type { PageInitializer, PageLifecycle } from '../types.js';

export async function initAboutPage(): Promise<PageLifecycle | void> {
  return {};
}

export const initPage: PageInitializer = initAboutPage;
