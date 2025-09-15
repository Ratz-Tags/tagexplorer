import React from "react";
import ArtistCard from "./ArtistCard.jsx";

export default function ArtistGallery({ artists }) {
  return (
    <section id="artist-gallery" aria-label="Artist gallery" role="region">
      <h2 className="visually-hidden">Artists</h2>
      <div className="artist-gallery-grid">
        {artists.length === 0 ? (
          <div className="no-artists">No artists found.</div>
        ) : (
          artists.map(artist => <ArtistCard key={artist.name} artist={artist} />)
        )}
      </div>
    </section>
  );
}
