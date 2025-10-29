export type FoldMode = 'fold-cover' | 'fold-inner' | 'default';

export interface FoldAdapter {
  getMode(): FoldMode;
  subscribe(callback: (mode: FoldMode) => void): () => void;
  destroy(): void;
}

export interface ShellElements {
  shellRoot: HTMLElement;
  commandBar: Element | null;
  sidebar: Element | null;
  audioPanel: Element | null;
}

export interface PageInitContext {
  page: string;
  shell: ShellElements;
  foldAdapter: FoldAdapter;
}

export interface RouterNavigateEvent {
  url: URL;
  anchor: HTMLAnchorElement | null;
}

export interface PageLifecycle {
  beforeNavigate?: (event: RouterNavigateEvent) => Promise<void> | void;
  onDispose?: () => void;
}

export type PageInitializerResult = PageLifecycle | void | Promise<PageLifecycle | void>;

export type PageInitializer = (context: PageInitContext) => PageInitializerResult;

export interface PageModule {
  initPage?: PageInitializer;
  initLandingPage?: PageInitializer;
  initGalleryPage?: PageInitializer;
}

export interface MountShellOptions {
  page?: string;
}

export interface MountShellResult extends ShellElements {}

export interface RouterInitOptions {
  beforeNavigate?: (event: RouterNavigateEvent) => Promise<void> | void;
}
