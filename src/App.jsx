import React from 'react';
import { DanbooruProvider } from './context/DanbooruContext.jsx';
import Gallery from './components/Gallery.jsx';

export default function App() {
  return (
    <DanbooruProvider>
      <Gallery />
    </DanbooruProvider>
  );
}
