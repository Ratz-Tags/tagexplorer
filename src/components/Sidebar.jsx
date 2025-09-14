import React, { useEffect, useState } from 'react';
import artistsData from '../../artists.json';

export default function Sidebar({ onChange }) {
  const [selected, setSelected] = useState(() => {
    const stored = localStorage.getItem('favorite-artists');
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem('favorite-artists', JSON.stringify(selected));
    onChange(selected);
  }, [selected, onChange]);

  const toggle = (name) => {
    setSelected((prev) =>
      prev.includes(name)
        ? prev.filter((a) => a !== name)
        : [...prev, name]
    );
  };

  return (
    <aside className="w-56 bg-pink-100 p-2 overflow-y-auto">
      <h2 className="font-bold mb-2">Artists</h2>
      <ul>
        {artistsData.map((artist) => (
          <li key={artist.artistName} className="flex items-center mb-1">
            <input
              type="checkbox"
              className="mr-2"
              checked={selected.includes(artist.artistName)}
              onChange={() => toggle(artist.artistName)}
            />
            <span>{artist.artistName}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
