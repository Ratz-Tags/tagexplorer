import { getActiveTags, getKinkTags, toggleTag } from './tags.js';
import { createModal } from './ui.js';

let allArtists = [];

function setAllArtists(artists) {
  allArtists = Array.isArray(artists) ? artists : [];
}

function getTagCounts() {
  const counts = {};
  allArtists.forEach((a) => {
    (a.kinkTags || []).forEach((t) => {
      counts[t] = (counts[t] || 0) + 1;
    });
  });
  return counts;
}

function openTagExplorer() {
  const counts = getTagCounts();
  const allTags = getKinkTags();
  const active = getActiveTags();

  let sortMode = 'name';

  const container = document.createElement('div');
  container.className = 'tag-explorer';

  const header = document.createElement('div');
  header.className = 'tag-explorer-header';

  const title = document.createElement('h3');
  title.textContent = 'Tags';
  header.appendChild(title);

  const sortSelect = document.createElement('select');
  sortSelect.innerHTML = `<option value="name">Sort: Name</option><option value="count">Sort: Count</option>`;
  sortSelect.onchange = () => {
    sortMode = sortSelect.value;
    renderList();
  };
  header.appendChild(sortSelect);

  container.appendChild(header);

  const list = document.createElement('div');
  list.className = 'tag-explorer-tags';
  container.appendChild(list);

  function renderList() {
    list.innerHTML = '';
    const tags = allTags.slice().sort((a, b) => {
      if (sortMode === 'count') {
        return (counts[b] || 0) - (counts[a] || 0);
      }
      return a.localeCompare(b);
    });
    tags.forEach((tag) => {
      const btn = document.createElement('button');
      btn.className = 'tag-button';
      btn.textContent = `${tag.replace(/_/g, ' ')} (${counts[tag] || 0})`;
      if (active.has(tag)) btn.classList.add('active');
      btn.onclick = () => {
        toggleTag(tag);
        if (active.has(tag)) {
          active.delete(tag);
          btn.classList.remove('active');
        } else {
          active.add(tag);
          btn.classList.add('active');
        }
      };
      list.appendChild(btn);
    });
  }

  const modal = createModal(container, 'modal');
  document.body.appendChild(modal);
  renderList();
}

export { openTagExplorer, setAllArtists };
