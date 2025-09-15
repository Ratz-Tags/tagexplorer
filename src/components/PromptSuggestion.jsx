import React from "react";

export default function PromptSuggestion({ selectedArtists, allArtists }) {
  // Find tags for selected artists
  const selectedTags = selectedArtists
    .map(name => (allArtists.find(a => a.name === name)?.tags || []))
    .filter(Boolean);

  // Count tag overlaps
  const tagCounts = {};
  selectedTags.forEach(tags => {
    tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  // Only show tags that appear in all selected artists
  const overlappedTags = Object.entries(tagCounts)
    .filter(([tag, count]) => count === selectedArtists.length && selectedArtists.length > 1)
    .map(([tag]) => tag);

  return (
    <div className="prompt-suggestion">
      <button disabled={selectedArtists.length < 2} className="suggestion-btn">
        Suggest Overlapped Tags
      </button>
      {selectedArtists.length >= 2 && overlappedTags.length > 0 && (
        <div className="suggested-tags">
          <strong>Overlapped Tags:</strong> {overlappedTags.join(", ")}
        </div>
      )}
      {selectedArtists.length >= 2 && overlappedTags.length === 0 && (
        <div className="suggested-tags">No overlapped tags found.</div>
      )}
    </div>
  );
}
