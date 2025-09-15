import React, { useState } from "react";

export default function TagExplorer({ tags, activeTags, onTagToggle, onClose }) {
  const [search, setSearch] = useState("");

  // Filter tags by search
  const filteredTags = tags.filter(tag => tag.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="tag-explorer-modal" role="dialog" aria-modal="true">
      <div className="tag-explorer-wrapper">
        <div className="tag-explorer-header">
          <input
            type="text"
            className="tag-explorer-search"
            placeholder="Search tags..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search tags"
            autoFocus
          />
          <button className="tag-explorer-close" onClick={onClose} aria-label="Close tag explorer">✕</button>
        </div>
        <div className="tag-explorer-tags">
          {filteredTags.length === 0 && <div className="tag-explorer-empty">No tags found.</div>}
          {filteredTags.map(tag => (
            <button
              key={tag}
              className={
                "tag-pill" + (activeTags.includes(tag) ? " active" : "")
              }
              onClick={() => onTagToggle(tag)}
              aria-pressed={activeTags.includes(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
