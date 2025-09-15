import React from "react";

export default function ArtistCard({ artist }) {
  return (
    <div className="artist-card">
      <div className="artist-media">
        {/* Replace with real image if available */}
        <img className="artist-image" src={artist.image || "fallback.jpg"} alt={artist.name} />
      </div>
      <div className="artist-footer">
        <span className="artist-name">{artist.name}</span>
        <div className="artist-tags">
          {artist.tags.map(tag => (
            <span className="gallery-tag" key={tag}>{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
