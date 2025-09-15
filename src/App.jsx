import React, { useState } from "react";
import { DanbooruProvider } from './context/DanbooruContext.jsx';
import Gallery from './components/Gallery.jsx';
import TagExplorer from "./components/TagExplorer.jsx";
import TagBar from "./components/TagBar.jsx";
import TagFilter from "./components/TagFilter.jsx";
import ArtistGallery from "./components/ArtistGallery.jsx";
import Sidebar from "./components/Sidebar.jsx";
import AudioPanel from "./components/AudioPanel.jsx";
import JrpgBubbles from "./components/JrpgBubbles.jsx";
import PromptSuggestion from "./components/PromptSuggestion.jsx";

// Example tag list (replace with real data or fetch as needed)
const ALL_TAGS = [
  "femdom", "chastity", "sissy", "bondage", "humiliation", "bimbofication", "pegging", "hypnosis", "tentacle", "public", "cum", "pet_play", "mind_break", "netorare"
];

export default function App() {
  const [tagExplorerOpen, setTagExplorerOpen] = useState(false);
  const [activeTags, setActiveTags] = useState([]);
  const [tagSearch, setTagSearch] = useState("");
  const [artistName, setArtistName] = useState("");
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [audioVisible, setAudioVisible] = useState(false);
  const [copiedArtists, setCopiedArtists] = useState([]);
  const [audioTrack, setAudioTrack] = useState("");
  const [bubbles, setBubbles] = useState([]);
  const [selectedCopied, setSelectedCopied] = useState([]);
  const [showPrompt, setShowPrompt] = useState(false);

  // Tag toggle logic
  function handleTagToggle(tag) {
    setActiveTags(tags =>
      tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag]
    );
  }

  function handleClearTags() {
    setActiveTags([]);
    setTagSearch("");
    setArtistName("");
  }

  // Filtered tags for TagExplorer
  const filteredTags = ALL_TAGS.filter(tag => tag.toLowerCase().includes(tagSearch.toLowerCase()));

  // Example: Filtered artists (replace with real data)
  const allArtists = [
    { name: "Artist1", tags: ["femdom", "chastity"] },
    { name: "Artist2", tags: ["bimbofication", "pegging"] },
    { name: "Artist3", tags: ["tentacle", "public"] },
    { name: "Artist4", tags: ["sissy", "humiliation"] },
  ];
  const filteredArtists = allArtists.filter(artist =>
    (activeTags.length === 0 || activeTags.every(tag => artist.tags.includes(tag))) &&
    artist.name.toLowerCase().includes(artistName.toLowerCase())
  );

  // Example handlers (replace with real logic)
  function handleCopyArtist(name) {
    setCopiedArtists(list => list.includes(name) ? list : [...list, name]);
  }
  function handleAudioPrev() {}
  function handleAudioNext() {}
  function handleAudioToggle() {}
  function handleMoanMute() {}
  function handleAddBubble(msg) { setBubbles(b => [...b, msg]); setTimeout(() => setBubbles(b => b.slice(1)), 4000); }
  function handleToggleSelect(name) {
    setSelectedCopied(sel =>
      sel.includes(name) ? sel.filter(n => n !== name) : [...sel, name]
    );
  }
  function handlePrompt() {
    setShowPrompt(true);
  }
  function handleSidebarClose() {
    setSidebarVisible(false);
    setShowPrompt(false);
  }

  return (
    <div className="fem-theme">
      {/* Background decoration */}
      <div id="background-blur" aria-hidden="true"></div>

      {/* Main application header */}
      <header role="banner">
        <div className="mx-auto max-w-screen-lg">
          <div id="top-bar" className="flex items-center justify-center gap-3 w-full px-4 py-2 text-pink-800 text-[1.04em] font-semibold bg-pink-gradient shadow-card border-b-2 border-pink-500/40 rounded-b-card sticky top-0 left-0 z-[10000]">
            <h1 className="brand">Artist Explorer</h1>
            <div className="brand-sissy">✧ Welcome cutie. ✧<br />Obey, drool, and discover your next obsession~</div>
            <span className="tagline" id="tagline">Pathetic..~</span>
          </div>
          {/* New compact tag explorer bar */}
          <div id="tag-explorer-bar" className="flex items-center justify-center gap-3 w-full px-4 py-2 text-pink-800 text-[1.04em] font-semibold bg-pink-gradient shadow-card border-b-2 border-pink-500/40 rounded-b-card sticky left-0" style={{ top: "var(--tagbar-top)" }}>
            <button className="bar-btn" id="prompts-btn">Prompts</button>
            <button className="bar-btn" id="filters-btn" aria-expanded="false" aria-controls="filter-controls">Filters</button>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main role="main" className="mx-auto max-w-screen-lg">
        {/* Tag filtering controls */}
        <section id="filter-controls" className="filter-controls" aria-label="Tag filters" aria-hidden="true">
          <div className="filter-inputs">
            <input id="tag-search" type="text" placeholder="Search tags" aria-label="Search tags" />
            <input id="artist-name-filter" type="text" placeholder="Filter artists by name" aria-label="Filter artists by name" />
            <button id="clear-tags" className="browse-btn">Clear Tags</button>
          </div>
          <div id="tag-buttons" className="tag-buttons" role="group" aria-label="Tag filters"></div>
        </section>

        {/* Selected tags bar */}
        <section id="selected-tags" aria-label="Selected tags" className="flex flex-wrap gap-2 w-full px-4 py-2 text-pink-800 text-[1.04em] font-semibold bg-pink-gradient shadow-card border-b-2 border-pink-500/40 rounded-b-card" style={{ display: "none" }}></section>

        {/* Filter results summary */}
        <section id="filtered-results" aria-live="polite" aria-label="Search results summary">
          Showing {filteredArtists.length} of {allArtists.length} artists
        </section>

        {/* Artist gallery (React component) */}
        <ArtistGallery artists={filteredArtists} />
      </main>

      {/* Sidebar for copied artists */}
      <Sidebar
        visible={sidebarVisible}
        onClose={handleSidebarClose}
        copiedArtists={copiedArtists}
        selected={selectedCopied}
        onToggleSelect={handleToggleSelect}
        onPrompt={handlePrompt}
      />

      {/* Audio controls */}
      <AudioPanel
        visible={audioVisible}
        onClose={() => setAudioVisible(false)}
        trackName={audioTrack}
        onPrev={handleAudioPrev}
        onNext={handleAudioNext}
        onToggle={handleAudioToggle}
        onMoanMute={handleMoanMute}
      />

      {/* Interactive elements overlay */}
      <JrpgBubbles bubbles={bubbles} />

      {/* Floating controls */}
      <nav className="floating-controls" aria-label="Quick access controls">
        <div className="toggle-buttons-container">
          <button className="sidebar-toggle" aria-label="Show copied artists sidebar">🎀</button>
          <button className="audio-toggle" aria-label="Show audio panel">🎶</button>
          <button className="theme-toggle" aria-label="Toggle theme">🌓</button>
        </div>
        <button id="back-to-top" title="Back to top" aria-label="Scroll to top">
          <span aria-hidden="true">↑</span>
          <span className="control-label">Top</span>
        </button>
      </nav>

      {/* TagBar at the top */}
      <TagBar
        onOpenTagExplorer={() => setTagExplorerOpen(true)}
        activeTags={activeTags}
        onClearTags={handleClearTags}
      />

      {/* TagExplorer modal */}
      {tagExplorerOpen && (
        <TagExplorer
          tags={filteredTags}
          activeTags={activeTags}
          onTagToggle={handleTagToggle}
          onClose={() => setTagExplorerOpen(false)}
        />
      )}

      {/* Tag filter/search UI */}
      <TagFilter
        search={tagSearch}
        setSearch={setTagSearch}
        artistName={artistName}
        setArtistName={setArtistName}
        onClear={handleClearTags}
      />
      {showPrompt && (
        <PromptSuggestion
          selectedArtists={selectedCopied}
          allArtists={allArtists}
        />
      )}
    </div>
  );
}
