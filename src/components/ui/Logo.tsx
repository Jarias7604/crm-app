import React from 'react';

interface LogoProps {
  mode?: 'light' | 'dark' | 'icon';
  className?: string;
  height?: number | string;
}

export default function Logo({ mode = 'dark', className = '', height = 38 }: LogoProps) {
  if (mode === 'icon') {
    return (
      <svg
        viewBox="0 0 512 512"
        width={512}
        height={512}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ height, width: 'auto' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="logo-blue-cyan-grad-icon" x1="10%" y1="10%" x2="90%" y2="90%">
            <stop offset="0%" stop-color="#00C2FF" />
            <stop offset="100%" stop-color="#0047FF" />
          </linearGradient>
        </defs>
        <path
          d="M 310,108 A 148,148 0 0,1 310,404"
          stroke="url(#logo-blue-cyan-grad-icon)"
          stroke-width="48"
          stroke-linecap="round"
        />
        <path
          d="M 135,365 L 235,185 L 285,270"
          stroke="url(#logo-blue-cyan-grad-icon)"
          stroke-width="48"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="256" cy="360" r="35" fill="url(#logo-blue-cyan-grad-icon)" />
      </svg>
    );
  }

  // Render the exact brand logo image uploaded in production
  // Append a cache buster query parameter to force browser update
  return (
    <img
      src="/logo-uploaded.png?v=5"
      alt="Arias CRM"
      className={className}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        width: 'auto',
        display: 'block',
        objectFit: 'contain',
        imageRendering: 'auto'
      }}
    />
  );
}
