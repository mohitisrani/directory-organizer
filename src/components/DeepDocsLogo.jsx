// src/components/DeepDocsLogo.jsx
import React from "react";

/**
 * DeepDocsLogo
 * - Pure SVG, no external assets.
 * - Respects parent size; control via className (e.g., "w-9 h-9").
 * - Auto dark-mode friendly: text uses currentColor.
 */
export default function DeepDocsLogo({ className = "w-9 h-9" }) {
  return (
    <svg
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="DeepDocs logo"
    >
      {/* Rounded square background */}
      <defs>
        <linearGradient id="ddg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopOpacity="1" stopColor="#9B8CFF" />
          <stop offset="100%" stopOpacity="1" stopColor="#5B46F3" />
        </linearGradient>
        <filter id="dd-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.18" />
        </filter>
      </defs>

      <rect
        x="6"
        y="6"
        width="116"
        height="116"
        rx="22"
        fill="url(#ddg)"
        stroke="#0F172A"
        strokeOpacity="0.9"
        strokeWidth="4"
        filter="url(#dd-shadow)"
      />

      {/* Folder shape */}
      <path
        d="M26 45c0-6 5-11 11-11h18c4 0 7 1 9 4l4 5h24c6 0 11 5 11 11v34c0 6-5 11-11 11H37c-6 0-11-5-11-11V45z"
        fill="white"
        fillOpacity="0.16"
        stroke="#0F172A"
        strokeOpacity="0.75"
        strokeWidth="4"
      />

      {/* Document card inside folder */}
      <rect
        x="36"
        y="54"
        width="44"
        height="30"
        rx="6"
        fill="white"
        fillOpacity="0.9"
      />
      <rect x="42" y="60" width="28" height="5" rx="2.5" fill="#5B46F3" />
      <rect x="42" y="68" width="20" height="5" rx="2.5" fill="#C7BFFF" />

      {/* Magnifying glass */}
      <g transform="translate(70,78)">
        <circle cx="22" cy="22" r="16" fill="white" />
        <circle cx="22" cy="22" r="16" fill="white" fillOpacity="0.92" />
        <circle cx="22" cy="22" r="16" fill="none" stroke="#0F172A" strokeWidth="4" />
        <rect
          x="34"
          y="34"
          width="16"
          height="6"
          rx="3"
          transform="rotate(45 34 34)"
          fill="#0F172A"
        />
        <circle cx="18" cy="18" r="6" fill="#EAE7FF" />
      </g>
    </svg>
  );
}
