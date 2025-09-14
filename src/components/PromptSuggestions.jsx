import React, { useEffect, useState } from 'react';
import { fetchArtistPage } from '../api.js';

export default function PromptSuggestions({ artists }) {
  const [tags, setTags] = useState([]);

  useEffect(() => {
    const run = async () => {
      if (!artists.length) {
        setTags([]);
        return;
      }
      const counts = {};
      for (const name of artists) {
        const posts = await fetchArtistPage(name, 1);
        posts.forEach((p) => {
          const tagArr = (p.tag_string || '').split(' ');
          tagArr.forEach((t) => {
            counts[t] = (counts[t] || 0) + 1;
          });
        });
      }
      const overlapping = Object.entries(counts)
        .filter(([, c]) => c === artists.length)
        .map(([tag]) => tag)
        .slice(0, 20);
      setTags(overlapping);
    };
    run();
  }, [artists]);

  if (!artists.length) return null;

  return (
    <section className="p-2 bg-pink-50 border-b border-pink-200">
      <h2 className="font-bold mb-1">Prompt Suggestions</h2>
      <div className="text-sm flex flex-wrap gap-1">
        {tags.map((t) => (
          <span key={t} className="px-2 py-1 bg-pink-200 rounded">{t}</span>
        ))}
      </div>
    </section>
  );
}
