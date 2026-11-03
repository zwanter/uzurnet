import React from 'react'

interface CountryFlagProps {
  countryCode: string
  className?: string
}

export const CountryFlag: React.FC<CountryFlagProps> = ({ countryCode, className = '' }) => {
  const code = (countryCode || '').toUpperCase()

  const flagContent = () => {
    switch (code) {
      case 'FR':
        // France: Blue, White, Red vertical stripes
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="213.3" height="480" fill="#002654" />
            <rect x="213.3" width="213.4" height="480" fill="#ffffff" />
            <rect x="426.7" width="213.3" height="480" fill="#ce1126" />
          </svg>
        )
      case 'US':
        // USA: Stripes and canton
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="640" height="480" fill="#b22234" />
            <path d="M0,74h640M0,148h640M0,222h640M0,295h640M0,369h640M0,443h640" stroke="#fff" strokeWidth="37" />
            <rect width="280" height="260" fill="#3c3b6e" />
            <circle cx="60" cy="50" r="10" fill="#fff" />
            <circle cx="140" cy="50" r="10" fill="#fff" />
            <circle cx="220" cy="50" r="10" fill="#fff" />
            <circle cx="100" cy="110" r="10" fill="#fff" />
            <circle cx="180" cy="110" r="10" fill="#fff" />
            <circle cx="60" cy="170" r="10" fill="#fff" />
            <circle cx="140" cy="170" r="10" fill="#fff" />
            <circle cx="220" cy="170" r="10" fill="#fff" />
          </svg>
        )
      case 'GB':
      case 'UK':
        // UK Union Jack
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="640" height="480" fill="#012169" />
            <path d="M0,0 L640,480 M640,0 L0,480" stroke="#fff" strokeWidth="60" />
            <path d="M0,0 L640,480 M640,0 L0,480" stroke="#c8102e" strokeWidth="36" />
            <path d="M320,0 V480 M0,240 H640" stroke="#fff" strokeWidth="100" />
            <path d="M320,0 V480 M0,240 H640" stroke="#c8102e" strokeWidth="60" />
          </svg>
        )
      case 'DE':
        // Germany: Black, Red, Gold horizontal stripes
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="640" height="160" fill="#000000" />
            <rect y="160" width="640" height="160" fill="#dd0000" />
            <rect y="320" width="640" height="160" fill="#ffce00" />
          </svg>
        )
      case 'NL':
        // Netherlands: Red, White, Blue horizontal stripes
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="640" height="160" fill="#ae1c28" />
            <rect y="160" width="640" height="160" fill="#ffffff" />
            <rect y="320" width="640" height="160" fill="#21468b" />
          </svg>
        )
      case 'FI':
        // Finland: Nordic Blue cross on White
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="640" height="480" fill="#ffffff" />
            <rect x="180" width="100" height="480" fill="#003580" />
            <rect y="190" width="640" height="100" fill="#003580" />
          </svg>
        )
      case 'SE':
        // Sweden: Nordic Yellow cross on Blue
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="640" height="480" fill="#006aa7" />
            <rect x="180" width="90" height="480" fill="#fecc00" />
            <rect y="195" width="640" height="90" fill="#fecc00" />
          </svg>
        )
      case 'PL':
        // Poland: White, Red
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="640" height="240" fill="#ffffff" />
            <rect y="240" width="640" height="240" fill="#dc143c" />
          </svg>
        )
      case 'EE':
        // Estonia: Blue, Black, White
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="640" height="160" fill="#0072ce" />
            <rect y="160" width="640" height="160" fill="#000000" />
            <rect y="320" width="640" height="160" fill="#ffffff" />
          </svg>
        )
      case 'AT':
        // Austria: Red, White, Red
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="640" height="160" fill="#ed2939" />
            <rect y="160" width="640" height="160" fill="#ffffff" />
            <rect y="320" width="640" height="160" fill="#ed2939" />
          </svg>
        )
      case 'TR':
        // Turkey: Red with crescent and star
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="640" height="480" fill="#e30a17" />
            <circle cx="270" cy="240" r="120" fill="#ffffff" />
            <circle cx="300" cy="240" r="96" fill="#e30a17" />
            <polygon points="380,240 340,225 355,268 355,212 340,255" fill="#ffffff" />
          </svg>
        )
      case 'RU':
        // Russia: White, Blue, Red
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="640" height="160" fill="#ffffff" />
            <rect y="160" width="640" height="160" fill="#0039a6" />
            <rect y="320" width="640" height="160" fill="#d52b1e" />
          </svg>
        )
      case 'UA':
        // Ukraine: Blue, Yellow
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="640" height="240" fill="#0057b7" />
            <rect y="240" width="640" height="240" fill="#ffd700" />
          </svg>
        )
      case 'KZ':
        // Kazakhstan: Cyan with gold
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="640" height="480" fill="#00afca" />
            <circle cx="320" cy="220" r="60" fill="#fec50c" />
            <path d="M220,290 Q320,260 420,290 Q320,310 220,290" fill="#fec50c" />
          </svg>
        )
      case 'CH':
        // Switzerland: Red with white cross
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="640" height="480" fill="#d52b1e" />
            <rect x="270" y="120" width="100" height="240" fill="#ffffff" />
            <rect x="200" y="190" width="240" height="100" fill="#ffffff" />
          </svg>
        )
      case 'JP':
        // Japan
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="640" height="480" fill="#ffffff" />
            <circle cx="320" cy="240" r="110" fill="#bc002d" />
          </svg>
        )
      case 'SG':
        // Singapore
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="640" height="240" fill="#ed2939" />
            <rect y="240" width="640" height="240" fill="#ffffff" />
            <circle cx="120" cy="120" r="60" fill="#ffffff" />
            <circle cx="140" cy="120" r="50" fill="#ed2939" />
          </svg>
        )
      case 'CA':
        // Canada
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <rect width="160" height="480" fill="#d52b1e" />
            <rect x="160" width="320" height="480" fill="#ffffff" />
            <rect x="480" width="160" height="480" fill="#d52b1e" />
            <polygon points="320,150 340,210 390,200 350,240 370,290 320,260 270,290 290,240 250,200 300,210" fill="#d52b1e" />
          </svg>
        )
      default:
        // Elegant Fallback Globe
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-emerald-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        )
    }
  }

  return (
    <div
      className={`inline-flex items-center justify-center w-6 h-[17px] rounded-[4px] overflow-hidden border border-white/20 shadow-xs shrink-0 select-none bg-white/5 ${className}`}
      title={code}
    >
      {flagContent()}
    </div>
  )
}

export default CountryFlag
