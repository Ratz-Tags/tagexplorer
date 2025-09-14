import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDanbooru } from '../context/DanbooruContext.jsx';

export default function Gallery() {
  const { artists, tags, fetchArtistPage } = useDanbooru();
  const [selectedTags, setSelectedTags] = useState([]);
  const [images, setImages] = useState([]);
  const [artistIndex, setArtistIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [allLoaded, setAllLoaded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [zoomSrc, setZoomSrc] = useState(null);
  const loaderRef = useRef(null);

  const filteredArtists = artists.filter((a) =>
    selectedTags.every((t) => a.kinkTags.includes(t))
  );

  const currentArtist = filteredArtists[artistIndex];

  const loadMore = useCallback(async () => {
    if (!currentArtist) {
      setAllLoaded(true);
      return;
    }
    const posts = await fetchArtistPage(
      currentArtist.artistName,
      selectedTags,
      page
    );
    if (posts.length === 0) {
      if (artistIndex + 1 < filteredArtists.length) {
        setArtistIndex((i) => i + 1);
        setPage(1);
      } else {
        setAllLoaded(true);
      }
      return;
    }
    const mapped = posts.map((p) => ({
      id: p.id,
      url: p.large_file_url || p.file_url,
      artist: currentArtist.artistName,
    }));
    setImages((prev) => [...prev, ...mapped]);
    setPage((p) => p + 1);
  }, [currentArtist, selectedTags, page, artistIndex, filteredArtists, fetchArtistPage]);

  useEffect(() => {
    setImages([]);
    setArtistIndex(0);
    setPage(1);
    setAllLoaded(false);
  }, [selectedTags, artists]);

  useEffect(() => {
    if (currentArtist) loadMore();
  }, [currentArtist, loadMore]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !allLoaded) {
        loadMore();
      }
    });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loadMore, allLoaded]);

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div>
      <button onClick={() => setShowFilters((s) => !s)}>Filters</button>
      {showFilters && (
        <div className="filter-panel">
          {tags.map((tag) => (
            <label key={tag} style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={selectedTags.includes(tag)}
                onChange={() => toggleTag(tag)}
              />
              {tag}
            </label>
          ))}
        </div>
      )}
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '4px' }}>
        {images.map((img) => (
          <div key={img.id} className="item" style={{ position: 'relative' }}>
            <img
              src={img.url}
              alt=""
              style={{ width: '100%', height: 'auto', cursor: 'pointer' }}
              onClick={() => setZoomSrc(img.url)}
            />
            <div className="artist-label" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '0.8em' }}>
              {img.artist}
            </div>
          </div>
        ))}
      </div>
      {zoomSrc && (
        <div
          className="zoom-viewer"
          onClick={() => setZoomSrc(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <img src={zoomSrc} alt="zoom" style={{ maxWidth: '90%', maxHeight: '90%' }} />
        </div>
      )}
      {!allLoaded && <div ref={loaderRef} style={{ height: '20px' }} />}
      {allLoaded && <div className="loaded-msg">All pages loaded</div>}
    </div>
  );
}
