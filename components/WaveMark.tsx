/**
 * The wave-mark — three stacked crest lines, the top one breaking.
 * `animated` gently draws the top crest (used only on the S1 hero;
 * disabled under prefers-reduced-motion via CSS).
 */
export function WaveMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-block ${className}`} aria-hidden="true">
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 16c5-7 10-7 15 0s10 7 15 0 8-5 10-2"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M4 27c5-6 10-6 15 0s10 6 15 0 8-4 10-2"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.65"
        />
        <path
          d="M4 38c5-5 10-5 15 0s10 5 15 0 8-3 10-2"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.35"
        />
      </svg>
    </span>
  );
}
