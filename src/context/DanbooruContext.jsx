import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchArtistPage } from '../services/danbooru.js';

const DanbooruContext = createContext();

export function DanbooruProvider({ children }) {
  const [artists, setArtists] = useState([]);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    fetch('artists.json').then((r) => r.json()).then(setArtists);
    fetch('kink-tags.json').then((r) => r.json()).then(setTags);
  }, []);

  return (
    <DanbooruContext.Provider value={{ artists, tags, fetchArtistPage }}>
      {children}
    </DanbooruContext.Provider>
  );
}

export function useDanbooru() {
  return useContext(DanbooruContext);
}
