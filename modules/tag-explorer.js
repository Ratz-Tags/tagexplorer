import { getActiveTags, getKinkTags, toggleTag, getArtistNameFilter, handleArtistNameFilter } from "./tags.js";

let allArtists = [];
let allArtistsCache = null;

function setAllArtists(artists) {
  if (allArtistsCache && JSON.stringify(allArtistsCache) === JSON.stringify(artists)) return;
  allArtists = Array.isArray(artists) ? artists : [];
  allArtistsCache = artists;
}

function getFilteredArtists(active) {
  const nameFilter = (getArtistNameFilter && getArtistNameFilter() || '').toLowerCase();
  return allArtists.filter((a) => {
    const tags = Array.isArray(a.kinkTags) ? a.kinkTags : [];
    if (![...active].every((t) => tags.includes(t))) return false;
    if (nameFilter && !a.artistName.toLowerCase().includes(nameFilter)) return false;
    return true;
  });
}

function getFilteredCounts(active) {
  const counts = {};
  const countedArtists = {};
  const filtered = getFilteredArtists(active);
  filtered.forEach((a) => {
    const artistName = a.artistName;
    const tags = Array.isArray(a.kinkTags) ? a.kinkTags : [];
    tags.forEach((t) => {
      if (!countedArtists[t]) countedArtists[t] = new Set();
      if (!countedArtists[t].has(artistName)) {
        countedArtists[t].add(artistName);
        counts[t] = (counts[t] || 0) + 1;
      }
    });
  });
  return counts;
}

// No longer needed: groupTags. We'll use kink categories directly.

function openTagExplorer() {
  const existing = document.querySelector('.tag-explorer-wrapper');
  if (existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.className = 'tag-explorer-wrapper';
  wrapper.addEventListener('click', (e) => {
    if (e.target === wrapper) wrapper.remove();
  });

  const sidebar = document.createElement('div');
  sidebar.className = 'tag-explorer';
  wrapper.appendChild(sidebar);
  document.body.appendChild(wrapper);

  const header = document.createElement('div');
  header.className = 'tag-explorer-header';
  const title = document.createElement('h3');
  title.textContent = 'Tags';
  header.appendChild(title);
  const closeBtn = document.createElement('button');
  closeBtn.className = 'zoom-close';
  closeBtn.textContent = '×';
  closeBtn.onclick = () => wrapper.remove();
  closeBtn.title = 'Close';
  header.appendChild(closeBtn);
  const clearBtn = document.createElement('button');
  clearBtn.className = 'tag-explorer-clear';
  clearBtn.textContent = 'Clear';
  clearBtn.onclick = () => {
    // Clear all tags using toggleTag until none left
    const active = getActiveTags();
    if (active && active.size) {
      [...active].forEach(tag => toggleTag(tag));
    }
    searchInput.value = '';
    nameInput.value = '';
    handleArtistNameFilter('');
    renderList();
  };
  header.appendChild(clearBtn);
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search tags';
  searchInput.oninput = renderList;
  header.appendChild(searchInput);
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Filter artists';
  nameInput.value = getArtistNameFilter ? getArtistNameFilter() : '';
  nameInput.oninput = () => {
    handleArtistNameFilter(nameInput.value);
    renderList();
  };
  header.appendChild(nameInput);
  sidebar.appendChild(header);


  // Selected tags bar (global, outside modal)
  let selectedTagsBar = document.querySelector('.selected-tags-bar');
  if (!selectedTagsBar) {
    selectedTagsBar = document.createElement('div');
    selectedTagsBar.className = 'selected-tags-bar';
    // Insert after .tag-explorer-bar if present
    const topBar = document.querySelector('.tag-explorer-bar, #tag-explorer-bar');
    if (topBar && topBar.parentNode) {
      topBar.parentNode.insertBefore(selectedTagsBar, topBar.nextSibling);
    } else {
      document.body.insertBefore(selectedTagsBar, document.body.firstChild);
    }
  }
  // Style for sticky and layout is handled in CSS

  const groupsContainer = document.createElement('div');
  groupsContainer.className = 'tag-explorer-groups';
  sidebar.appendChild(groupsContainer);
  const kinkCategories = getKinkTags(); // [{category, tags:[]}, ...]
  const openGroups = new Set();

  function renderList() {
    const active = getActiveTags();
    const counts = getFilteredCounts(active);
    const searchText = searchInput.value.toLowerCase();
    // Render selected tags bar (global)
    selectedTagsBar.innerHTML = '';
    if (active.size > 0) {
      const label = document.createElement('span');
      label.textContent = 'Selected:';
      label.style.fontWeight = 'bold';
      label.style.marginRight = '0.5em';
      label.style.color = '#a0005a';
      label.style.background = '#fff0fa';
      label.style.padding = '0.2em 0.7em';
      label.style.borderRadius = '1em';
      label.style.fontSize = '1.05em';
      selectedTagsBar.appendChild(label);
      active.forEach((tag) => {
        const pill = document.createElement('span');
        pill.className = 'selected-tag-pill';
        pill.textContent = tag.replace(/_/g, ' ');
        pill.title = 'Remove tag';
        pill.style.cursor = 'pointer';
        pill.style.background = 'linear-gradient(90deg, #ffd6f6 0%, #fd7bc5 100%)';
        pill.style.color = '#a0005a';
        pill.style.border = '1.5px solid #fd7bc5';
        pill.style.padding = '0.4em 1em';
        pill.style.borderRadius = '2em';
        pill.style.fontWeight = '500';
        pill.style.boxShadow = '0 1px 4px #fd7bc540';
        pill.onclick = () => {
          toggleTag(tag);
          renderList();
        };
        selectedTagsBar.appendChild(pill);
      });
    }
    groupsContainer.innerHTML = '';
    // Flatten all tags for verification
    let allTagsFlat = [];
    kinkCategories.forEach(cat => allTagsFlat.push(...cat.tags));
    // --- Verification: check for lost tags ---
    // If you want to check for lost tags, you can compare allTagsFlat to the original list.
    // ---
    kinkCategories.forEach(({ category, tags }) => {
      // Filter tags by search and by presence in filtered artists
      const filteredTags = tags
        .filter((t) => t.toLowerCase().includes(searchText))
        .filter((t) => counts[t] || active.has(t));
      if (filteredTags.length === 0) return;
      const section = document.createElement('div');
      section.className = 'tag-group';
      if (openGroups.has(category) || searchText || filteredTags.some((t) => active.has(t))) {
        section.classList.add('open');
      }
      const head = document.createElement('div');
      head.className = 'tag-group-header';
      head.textContent = category;
      head.onclick = () => {
        if (openGroups.has(category)) openGroups.delete(category);
        else openGroups.add(category);
        renderList();
      };
      section.appendChild(head);
      const tagsDiv = document.createElement('div');
      tagsDiv.className = 'tag-group-tags';
      filteredTags.forEach((tag) => {
        const btn = document.createElement('button');
        btn.className = 'tag-button';
        btn.textContent = `${tag.replace(/_/g,' ')} (${counts[tag] || 0})`;
        // Only highlight if tag is in active set
        if (active.has(tag)) btn.classList.add('active');
        btn.onclick = () => {
          toggleTag(tag);
          renderList();
        };
        tagsDiv.appendChild(btn);
      });
      section.appendChild(tagsDiv);
      groupsContainer.appendChild(section);
    });
  }

  renderList();
  requestAnimationFrame(() => sidebar.classList.add('open'));

  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') {
      wrapper.remove();
      document.removeEventListener('keydown', esc);
    }
  });
}

export { openTagExplorer, setAllArtists, getFilteredCounts };
