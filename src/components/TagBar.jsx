import React from "react";

export default function TagBar({ onOpenTagExplorer, activeTags, onClearTags }) {
  return (
    <div className="tag-bar">
      <button className="bar-btn" onClick={onOpenTagExplorer} aria-label="Open tag explorer">
        Tags
      </button>
      {activeTags.length > 0 && (
        <div className="active-tags">
          {activeTags.map(tag => (
            <span className="active-tag-pill" key={tag}>{tag}</span>
          ))}
          <button className="clear-tags-btn" onClick={onClearTags} aria-label="Clear all tags">✕</button>
        </div>
      )}
    </div>
  );
}
