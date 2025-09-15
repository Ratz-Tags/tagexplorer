import React from "react";

export default function Sidebar({ visible, onClose, copiedArtists, selected, onToggleSelect, onPrompt }) {
  return (
    <aside className={"sidebar-wrapper" + (visible ? " visible" : "") } aria-label="Copied artists">
      <div id="copied-sidebar" className={visible ? "sidebar-animated" : "sidebar-hidden"} role="complementary" aria-label="Artists you've copied">
        <button className="copied-sidebar-close" aria-label="Close sidebar" onClick={onClose}>X</button>
        <h2 className="visually-hidden">Copied Artists</h2>
        <ul>
          {copiedArtists.length === 0 ? (
            <li className="empty">No copied artists yet.</li>
          ) : (
            copiedArtists.map(name => (
              <li key={name}>
                <input
                  type="checkbox"
                  checked={selected.includes(name)}
                  onChange={() => onToggleSelect(name)}
                  aria-label={`Select ${name}`}
                />
                {name}
              </li>
            ))
          )}
        </ul>
        <button className="prompt-btn" onClick={onPrompt} disabled={selected.length < 2}>
          Generate Prompt Suggestion
        </button>
      </div>
    </aside>
  );
}
