function Logo() {
  return (
    <div className="brandLogo">
      <div className="logoIcon">
        <svg viewBox="0 0 100 100">
          <defs>
            <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
          </defs>

          <rect
            x="8"
            y="18"
            width="84"
            height="58"
            rx="18"
            fill="url(#g)"
          />

          <circle cx="36" cy="47" r="10" fill="white" />
          <circle cx="64" cy="47" r="10" fill="white" />

          <path
            d="M35 67 Q50 78 65 67"
            stroke="white"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />

          <path
            d="M38 76 L28 92 L55 78"
            fill="url(#g)"
          />
        </svg>
      </div>

      <div>
        <div className="logoText">Gadamy.TV</div>
        <div className="logoSub">poznawaj • gadaj • baw się</div>
      </div>
    </div>
  );
}

export default Logo;