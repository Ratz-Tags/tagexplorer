import React, { useEffect, useRef, useState } from 'react';
import { fetchArtistPage } from '../api.js';

function ZoomModal({ post, onClose }) {
  if (!post) return null;
  const url = post.large_file_url || post.file_url;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center" onClick={onClose}>
      <img src={url} alt={post.tag_string} className="max-h-full" />
    </div>
  );
}

export default function Gallery({ artist }) {
  const [images, setImages] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selected, setSelected] = useState(null);
  const loader = useRef(null);

  useEffect(() => {
    setImages([]);
    setPage(1);
    setHasMore(true);
  }, [artist]);

  useEffect(() => {
    if (!artist || !hasMore) return;
    let cancelled = false;
    fetchArtistPage(artist, page).then((posts) => {
      if (cancelled) return;
      setImages((prev) => [...prev, ...posts]);
      if (posts.length < 200) setHasMore(false);
    });
    return () => {
      cancelled = true;
    };
  }, [artist, page, hasMore]);

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        setPage((p) => p + 1);
      }
    });
    if (loader.current) obs.observe(loader.current);
    return () => obs.disconnect();
  }, [hasMore]);

  if (!artist) {
    return <p className="p-4 text-pink-600">Select an artist to view images.</p>;
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {images.map((post) => (
          <img
            key={post.id}
            src={post.preview_file_url || post.large_file_url || post.file_url}
            alt={post.tag_string}
            loading="lazy"
            className="w-full cursor-pointer"
            onClick={() => setSelected(post)}
          />
        ))}
      </div>
      <div ref={loader} />
      {selected && <ZoomModal post={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
