interface BikeMarkProps {
  size?: number;
  className?: string;
}

/**
 * BikeMark — the linework cyclist mark used as the brand glyph.
 * Inherits currentColor; pair with the wordmark in nav/footer.
 * Two wheels, top tube, down tube, seat tube, head tube, drops — minimal.
 */
export function BikeMark({ size = 28, className }: BikeMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx={8} cy={22} r={5} />
      <circle cx={24} cy={22} r={5} />
      <path d="M8 22 L13 12 L21 12 L24 22" />
      <path d="M13 12 L19 22" />
      <path d="M21 12 L19 22" />
      <path d="M11 12 L13 12" />
      <path d="M21 12 L23.5 10.5" />
      <circle cx={19} cy={22} r={0.9} fill="currentColor" stroke="none" />
    </svg>
  );
}
