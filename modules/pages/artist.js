import {
  getArtistBySlug,
  preloadArtistBySlug,
  fetchArtistImages,
  getAllArtistsList,
  getArtistSlug,
} from '../api.js';
import {
  loadFavorites,
  toggleFavorite,
  isFavorite,
} from '../favorites.js';
import { openLightbox } from '../lightbox.js';
import { findSimilarArtists, setAllArtists as setSimilarArtists } from '../similar-artists.js';

function resolveSlug() {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  if (params.has('slug')) {
    return params.get('slug');
  }
  if (params.has('id')) {
    return params.get('id');
  }
  const segments = url.pathname.split('/').filter(Boolean);
  const artistIndex = segments.indexOf('artist');
  if (artistIndex !== -1 && segments.length > artistIndex + 1) {
    const candidate = segments[artistIndex + 1];
    if (candidate && candidate !== '[id]') {
      return candidate;
    }
    if (segments.length > artistIndex + 2) {
      return segments[artistIndex + 2];
    }
  }
  return null;
}

function renderTags(container, tags = []) {
  container.innerHTML = '';
  if (!Array.isArray(tags) || tags.length === 0) {
    container.innerHTML = '<p>No recorded kink tags. Curious.</p>';
    return;
  }
  const title = document.createElement('h2');
  title.className = 'artist-section-title';
  title.textContent = 'Tags';
  container.appendChild(title);
  const list = document.createElement('ul');
  list.className = 'artist-tag-list';
  tags.forEach((tag) => {
    const item = document.createElement('li');
    item.textContent = tag.replace(/_/g, ' ');
    list.appendChild(item);
  });
  container.appendChild(list);
}

async function renderPreview(container, artist) {
  container.innerHTML = '';
  const figure = document.createElement('figure');
  figure.className = 'artist-preview-card';
  const img = document.createElement('img');
  img.alt = `${artist.artistName} preview`;
  img.loading = 'lazy';
  figure.appendChild(img);
  container.appendChild(figure);

  try {
    const posts = await fetchArtistImages(artist.artistName, [], { limit: 1, order: 'score' });
    const post = Array.isArray(posts)
      ? posts.find((p) => p?.large_file_url || p?.file_url)
      : null;
    if (post) {
      img.src = post.large_file_url || post.file_url;
    } else {
      container.innerHTML = '<p class="artist-preview-empty">No preview available yet.</p>';
    }
  } catch (error) {
    console.warn('[artist] Failed to load preview', error);
    container.innerHTML = '<p class="artist-preview-empty">Preview failed to load.</p>';
  }
}

function renderLinks(container, artist) {
  container.innerHTML = '';
  const list = document.createElement('ul');
  list.className = 'artist-link-list';

  const danbooru = document.createElement('a');
  danbooru.href = `https://danbooru.donmai.us/posts?tags=${encodeURIComponent(artist.artistName)}`;
  danbooru.target = '_blank';
  danbooru.rel = 'noopener';
  danbooru.textContent = 'Open on Danbooru';

  const copyLink = document.createElement('button');
  copyLink.type = 'button';
  copyLink.textContent = 'Copy tag';
  copyLink.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(artist.artistName);
      copyLink.textContent = 'Copied';
      setTimeout(() => (copyLink.textContent = 'Copy tag'), 1500);
    } catch (error) {
      console.warn('[artist] Failed to copy tag', error);
    }
  });

  const liDanbooru = document.createElement('li');
  liDanbooru.appendChild(danbooru);
  const liCopy = document.createElement('li');
  liCopy.appendChild(copyLink);
  list.append(liDanbooru, liCopy);
  container.appendChild(list);
}

async function renderSimilar(section, artist) {
  if (!section) return;
  const artists = await getAllArtistsList();
  setSimilarArtists(artists);
  const matches = findSimilarArtists(artist, { limit: 10, minSimilarity: 0.05, mode: 'content' });
  if (!matches.length) return;
  const list = section.querySelector('.artist-similar-list');
  list.replaceChildren(
    ...matches.map(({ artist: other, score }) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'artist-similar-link';
      link.href = `?slug=${encodeURIComponent(getArtistSlug(other.artistName))}`;
      const name = document.createElement('span');
      name.textContent = other.artistName.replace(/_/g, ' ');
      const meta = document.createElement('span');
      meta.className = 'artist-similar-meta';
      meta.textContent = `${Math.round(score * 100)}% match${other.postCount ? ` · ${other.postCount.toLocaleString()} posts` : ''}`;
      link.append(name, meta);
      item.appendChild(link);
      return item;
    }),
  );
  section.hidden = false;
}

function updateFavoriteButton(button, artistName) {
  if (!button) return;
  const favorite = isFavorite(artistName);
  button.textContent = favorite ? 'Remove favorite' : 'Add to favorites';
  button.setAttribute('aria-pressed', favorite ? 'true' : 'false');
}

export async function initArtistPage() {
  loadFavorites();
  const slug = resolveSlug();
  if (!slug) {
    const root = document.querySelector('[data-artist-root]');
    if (root) root.innerHTML = '<p>Missing artist identifier.</p>';
    return {};
  }

  await preloadArtistBySlug(slug);
  const artist = await getArtistBySlug(slug);
  if (!artist) {
    const root = document.querySelector('[data-artist-root]');
    if (root) root.innerHTML = '<p>Artist not found.</p>';
    return {};
  }

  const nameEl = document.querySelector('[data-artist-name]');
  const taglineEl = document.querySelector('[data-artist-tagline]');
  const previewEl = document.querySelector('[data-artist-preview]');
  const tagsEl = document.querySelector('[data-artist-tags]');
  const linksEl = document.querySelector('[data-artist-links]');
  const favoriteBtn = document.querySelector('[data-artist-favorite]');

  if (nameEl) {
    nameEl.textContent = artist.artistName.replace(/_/g, ' ');
  }
  if (taglineEl) {
    taglineEl.textContent =
      typeof artist.postCount === 'number' ? `${artist.postCount.toLocaleString()} posts on Danbooru` : '';
  }
  const browseBtn = document.querySelector('[data-artist-browse]');
  if (browseBtn) {
    browseBtn.addEventListener('click', () => {
      openLightbox(artist, {
        onCopy: (target) => navigator.clipboard?.writeText(`artist:${target.artistName}`).catch(() => {}),
      });
    });
  }
  renderSimilar(document.querySelector('[data-artist-similar]'), artist).catch((error) => {
    console.warn('[artist] Failed to find similar artists', error);
  });
  if (previewEl) {
    renderPreview(previewEl, artist);
    previewEl.addEventListener('click', () => document.querySelector('[data-artist-browse]')?.click());
  }
  if (tagsEl) {
    renderTags(tagsEl, artist.kinkTags);
  }
  if (linksEl) {
    renderLinks(linksEl, artist);
  }
  if (favoriteBtn) {
    updateFavoriteButton(favoriteBtn, artist.artistName);
    favoriteBtn.addEventListener('click', () => {
      const nowFavorite = toggleFavorite(artist.artistName);
      updateFavoriteButton(favoriteBtn, artist.artistName);
      favoriteBtn.dataset.favorite = nowFavorite ? 'true' : 'false';
    });
  }

  document.title = `TagExplorer · ${artist.artistName.replace(/_/g, ' ')}`;

  return {
    beforeNavigate: () => {
      if (favoriteBtn) {
        favoriteBtn.blur();
      }
    },
  };
}

export const initPage = initArtistPage;
