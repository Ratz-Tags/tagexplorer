import React, { useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Gallery from './components/Gallery.jsx';
import PromptSuggestions from './components/PromptSuggestions.jsx';
import AudioPlayer from './components/AudioPlayer.jsx';

export default function App() {
  const [selectedArtists, setSelectedArtists] = useState([]);
  return (
    <div className="flex h-screen">
      <Sidebar onChange={setSelectedArtists} />
      <main className="flex-1 overflow-y-auto">
        <PromptSuggestions artists={selectedArtists} />
        <Gallery artist={selectedArtists[0]} />
        <AudioPlayer />
      </main>
    </div>
  );
}
