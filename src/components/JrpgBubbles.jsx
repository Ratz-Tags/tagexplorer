import React from "react";

export default function JrpgBubbles({ bubbles }) {
  return (
    <div id="jrpg-bubbles" aria-live="polite" aria-label="Tag notifications">
      {bubbles.map((bubble, i) => (
        <div className="jrpg-bubble" key={i}>
          <img src="icons/chibi.png" className="chibi" alt="chibi" />
          <span>{bubble}</span>
        </div>
      ))}
    </div>
  );
}
