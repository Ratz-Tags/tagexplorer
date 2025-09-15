import React from "react";

export default function AudioPanel({ visible, onClose, trackName, onPrev, onNext, onToggle, onMoanMute }) {
  return (
    <section id="audio-section" aria-label="Audio controls">
      <div id="audio-panel" className={"audio-panel" + (visible ? "" : " hidden")} role="region" aria-label="Hypnosis audio player">
        <div className="audio-header">
          <span aria-label="Audio indicator">🎧</span>
          <span id="audio-track-name">{trackName || "No track playing"}</span>
        </div>
        <div className="audio-controls" role="group" aria-label="Audio playback controls">
          <button id="audio-prev" aria-label="Previous track" onClick={onPrev}>⏮️</button>
          <button id="audio-toggle" aria-label="Play/pause" onClick={onToggle}>⏯️</button>
          <button id="audio-next" aria-label="Next track" onClick={onNext}>⏭️</button>
          <button id="moan-mute" aria-label="Toggle moan sound" onClick={onMoanMute}>🔇 Moan</button>
        </div>
        <button className="audio-panel-close" aria-label="Close audio panel" onClick={onClose}>✕</button>
      </div>
      {/* Audio elements */}
      <audio id="moan-audio" preload="auto" aria-label="Moan sound effects">
        <source src="moan.mp3" type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
      <audio id="hypnoAudio" preload="auto" aria-label="Hypnosis audio tracks">
        Your browser does not support the audio element.
      </audio>
    </section>
  );
}
