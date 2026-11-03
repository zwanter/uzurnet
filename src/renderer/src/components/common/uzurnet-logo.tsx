import React from 'react'

interface LogoProps {
  className?: string
  size?: number | string
}

export const UzurNetLogo: React.FC<LogoProps> = ({ className = 'size-5', size }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <defs>
        <linearGradient id="uzurLogoGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="25%" stopColor="#34d399" />
          <stop offset="65%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#00f2fe" />
        </linearGradient>
      </defs>
      {/* Top Left Roof */}
      <path
        d="M 498.5 140.5 L 498.5 228.5 L 297.5 295.0 L 297.5 411.5 L 211.0 361.0 L 211.0 234.5 Z"
        fill="url(#uzurLogoGrad)"
      />
      {/* Top Right Roof */}
      <path
        d="M 525.5 140.5 L 813.0 234.5 L 813.0 361.0 L 726.5 411.5 L 726.5 295.0 L 525.5 228.5 Z"
        fill="url(#uzurLogoGrad)"
      />
      {/* Center Monolith U */}
      <path
        d="M 411.5 284.5 L 411.5 592.5 L 512.0 651.0 L 612.5 592.5 L 612.5 284.5 L 700.0 313.0 L 700.0 644.0 L 512.0 753.5 L 324.0 644.0 L 324.0 313.0 Z"
        fill="url(#uzurLogoGrad)"
      />
      {/* Bottom Left Bracket */}
      <path
        d="M 211.0 391.5 L 297.5 442.5 L 297.5 658.5 L 498.5 776.0 L 498.5 876.5 L 211.0 710.0 Z"
        fill="url(#uzurLogoGrad)"
      />
      {/* Bottom Right Bracket */}
      <path
        d="M 813.0 391.5 L 813.0 710.0 L 525.5 876.5 L 525.5 776.0 L 726.5 658.5 L 726.5 442.5 Z"
        fill="url(#uzurLogoGrad)"
      />
    </svg>
  )
}

export default UzurNetLogo
