import React from "react";

export default function TagFilter({ search, setSearch, artistName, setArtistName, onClear }) {
  return (
    <div className="filter-inputs">
      <input
        id="tag-search"
        type="text"
        placeholder="Search tags"
        aria-label="Search tags"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <input
        id="artist-name-filter"
        type="text"
        placeholder="Filter artists by name"
        aria-label="Filter artists by name"
        value={artistName}
        onChange={e => setArtistName(e.target.value)}
      />
      <button id="clear-tags" className="browse-btn" onClick={onClear}>
        Clear Tags
      </button>
    </div>
  );
}
