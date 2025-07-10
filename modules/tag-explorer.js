import {
  getActiveTags,
  getKinkTags,
  toggleTag,
  getArtistNameFilter,
} from './tags.js';

let allArtists = [];

function setAllArtists(artists) {
  allArtists = Array.isArray(artists) ? artists : [];
}

function getFilteredCounts(active) {
  const nameFilter = (getArtistNameFilter && getArtistNameFilter()) || '';
  const counts = {};
  allArtists.forEach((a) => {
    const tags = a.kinkTags || [];
    if (![...active].every((t) => tags.includes(t))) return;
    if (nameFilter && !a.artistName.toLowerCase().includes(nameFilter)) return;
    tags.forEach((t) => {
      counts[t] = (counts[t] || 0) + 1;
    });
  });
  return counts;
}

function openTagExplorer() {
  // Close any existing tag explorer
  const existingWrapper = document.querySelector('.fullscreen-wrapper.tag-explorer-wrapper');
  if (existingWrapper) {
    existingWrapper.remove();
  }

  const allTags = getKinkTags();
  let active = getActiveTags();

  let sortMode = 'name';
  let searchText = '';

  // Create fullscreen wrapper similar to zoom viewer
  const wrapper = document.createElement('div');
  wrapper.className = 'fullscreen-wrapper tag-explorer-wrapper';

  const container = document.createElement('div');
  container.className = 'tag-explorer';

  const header = document.createElement('div');
  header.className = 'tag-explorer-header';

  const title = document.createElement('h3');
  title.textContent = 'Browse Tags';
  header.appendChild(title);

  // Add close button in header
  const closeBtn = document.createElement('button');
  closeBtn.className = 'zoom-close';
  closeBtn.textContent = '×';
  closeBtn.onclick = () => wrapper.remove();

  const sortSelect = document.createElement('select');
  sortSelect.innerHTML = `<option value="name">Sort: Name</option><option value="count">Sort: Count</option>`;
  sortSelect.onchange = () => {
    sortMode = sortSelect.value;
    renderList();
  };
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search tags';
  searchInput.oninput = () => {
    searchText = searchInput.value.toLowerCase();
    renderList();
  };
  header.appendChild(searchInput);
  header.appendChild(sortSelect);

  container.appendChild(header);

  const list = document.createElement('div');
  list.className = 'tag-explorer-tags';
  container.appendChild(list);

  function renderList() {
    list.innerHTML = '';
    active = getActiveTags();
    const counts = getFilteredCounts(active);
    let tags = allTags.filter((t) =>
      t.toLowerCase().includes(searchText)
    );
    tags = tags.filter((t) => counts[t] || active.has(t));
    tags.sort((a, b) => {
      if (sortMode === 'count') {
        return (counts[b] || 0) - (counts[a] || 0);
      }
      return a.localeCompare(b);
    });
    if (tags.length === 0) {
      list.textContent = 'No tags';
      return;
    }
    tags.forEach((tag) => {
      const btn = document.createElement('button');
      btn.className = 'tag-button';
      btn.textContent = `${tag.replace(/_/g, ' ')} (${counts[tag] || 0})`;
      if (active.has(tag)) btn.classList.add('active');
      btn.onclick = () => {
        toggleTag(tag);
        renderList();
      };
      list.appendChild(btn);
    });
  }

  // Add keyboard handling (Escape key)
  wrapper.tabIndex = 0;
  wrapper.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeBtn.click();
      e.preventDefault();
    }
  });

  // Assemble the modal
  wrapper.appendChild(container);
  wrapper.appendChild(closeBtn);
  
  document.body.appendChild(wrapper);
  wrapper.focus();
  renderList();
}

export { openTagExplorer, setAllArtists };
