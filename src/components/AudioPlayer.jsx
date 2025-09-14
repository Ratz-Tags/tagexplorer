import React from 'react';

export default function AudioPlayer() {
  return (
    <div className="p-4">
      <audio controls className="w-full">
        <source src="/audio/moan.mp3" type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}
