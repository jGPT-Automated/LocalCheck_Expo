// LocalCheck brand mark — React DOM (no dependencies)
export function LocalCheckMark({ size = 42, frame = '#f2f2f6', check = '#fc4c02', ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
      <g stroke={frame} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 4H4v9" />
        <path d="M27 4h9v9" />
        <path d="M36 27v9h-9" />
        <path d="M4 27v9h9" />
      </g>
      <path d="M13.5 20.4 18 25l9-9.6" stroke={check} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Lock-up: mark + wordmark. Wordmark needs Oswald 600 loaded.
export function LocalCheckLogo({ size = 42, gap = 13, color = '#f2f2f6', check = '#fc4c02' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap }}>
      <LocalCheckMark size={size} frame={color} check={check} />
      <span style={{ fontFamily: '"Oswald", "Arial Narrow", sans-serif', fontSize: size * 0.6, fontWeight: 600, letterSpacing: '0.055em', color, textTransform: 'uppercase' }}>LocalCheck</span>
    </span>
  );
}
