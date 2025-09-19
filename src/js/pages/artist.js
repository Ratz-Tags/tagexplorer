import { initializeApp } from '../core/app.js';
import { safeAnimate } from '../core/motion.js';
import { parseSearchParams } from '../core/utils.js';
import { createWhisperController } from '../core/tts.js';
import { watchFoldState } from '../core/fold.js';

const params = parseSearchParams();
const artistId = params.get('id');

const card = document.querySelector('[data-artist-card]');
const previewImage = document.querySelector('[data-artist-preview]');
const nameEl = document.querySelector('[data-artist-name]');
const summaryEl = document.querySelector('[data-artist-summary]');
const tagsEl = document.querySelector('[data-artist-tags]');
const linksEl = document.querySelector('[data-artist-links]');
const whisperEl = document.querySelector('[data-artist-whisper]');
const backLink = document.querySelector('[data-artist-back]');

const WHISPER_COPY = [
  'Whispers are silenced. For now.',
  'A soft whisper will check in when you peek too long.',
  'Steady whispers track your every indulgence.',
  'Relentless whispers will interrupt the moment you linger.'
];

let whisperController = null;
let unwatchFold = null;

initializeApp('artist', {
  onReady({ dataset, preferences }) {
    unwatchFold = watchFoldState(() => {});
    whisperController = createWhisperController({ dataset, preferences });
    const artist = findArtist(dataset.artists, artistId);
    if (!artist) {
      renderMissing();
      return;
    }
    renderArtist(artist, dataset.tags);
    updateWhisper(preferences);
    animateCard();
    whisperController?.speak('artist_open');
    bindBackLink();
  },
  onPreferencesChange({ preferences }) {
    updateWhisper(preferences);
    whisperController?.updatePreferences(preferences);
  }
});

function findArtist(artists, id) {
  if (!Array.isArray(artists)) {
    return null;
  }
  return artists.find((entry) => entry.artist_id === id) ?? null;
}

function renderArtist(artist, tags) {
  if (!artist) {
    return;
  }

  const tagDictionary = new Map(tags.map((tag) => [tag.id, tag]));
  const humanTags = artist.tags.map((tagId) => tagDictionary.get(tagId)?.label ?? tagId.replace(/_/g, ' '));

  if (nameEl) {
    nameEl.textContent = artist.name;
  }

  if (summaryEl) {
    summaryEl.textContent = `Dominant tags: ${humanTags.join(', ')}.`;
  }

  if (previewImage) {
    previewImage.loading = 'lazy';
    previewImage.decoding = 'async';
    previewImage.referrerPolicy = 'no-referrer';
    previewImage.src = artist.preview;
    previewImage.alt = `${artist.name} preview`;
  }

  if (tagsEl) {
    tagsEl.innerHTML = '';
    const fragment = document.createDocumentFragment();
    artist.tags.forEach((tagId) => {
      const item = document.createElement('li');
      item.className = 'tag-chip bg-panel/60 text-[0.65rem] text-slate-200';
      const label = tagDictionary.get(tagId)?.label ?? tagId.replace(/_/g, ' ');
      item.textContent = label;
      item.title = tagDictionary.get(tagId)?.summary ?? label;
      fragment.appendChild(item);
    });
    tagsEl.appendChild(fragment);
  }

  if (linksEl) {
    linksEl.innerHTML = '';
    const fragment = document.createDocumentFragment();
    Object.entries(artist.links ?? {}).forEach(([key, url]) => {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noreferrer noopener';
      link.className = 'inline-flex items-center gap-2 text-accent-cyan hover:text-white';
      link.innerHTML = `<span class="uppercase tracking-[0.35em] text-[0.65rem]">${key}</span>`;
      fragment.appendChild(link);
    });
    if (!fragment.children.length) {
      const placeholder = document.createElement('p');
      placeholder.className = 'text-[0.65rem] uppercase tracking-[0.4em] text-slate-500';
      placeholder.textContent = 'Links withheld for now.';
      fragment.appendChild(placeholder);
    }
    linksEl.appendChild(fragment);
  }
}

function updateWhisper(preferences) {
  if (!whisperEl) {
    return;
  }
  const intensity = preferences?.tts?.muted ? 0 : preferences?.tts?.intensity ?? 0;
  whisperEl.textContent = WHISPER_COPY[intensity] ?? WHISPER_COPY[2];
}

function bindBackLink() {
  if (!backLink) {
    return;
  }
  backLink.addEventListener('click', () => {
    whisperController?.speak('back');
  });
}

function renderMissing() {
  if (!card) {
    return;
  }
  card.innerHTML = '';
  const message = document.createElement('div');
  message.className = 'flex flex-col items-center gap-4 text-center';
  const heading = document.createElement('h2');
  heading.className = 'font-display text-2xl text-white';
  heading.textContent = 'No artist loaded — did you sneak in without a dossier?';
  const action = document.createElement('a');
  action.href = '../gallery/';
  action.className = 'cta-button';
  action.textContent = 'Return to the gallery';
  message.append(heading, action);
  card.appendChild(message);
}

function animateCard() {
  if (!card) {
    return;
  }
  safeAnimate(card, { opacity: [0, 1], y: [24, 0] }, { duration: 0.8 });
}

window.addEventListener('beforeunload', () => {
  unwatchFold?.();
});
