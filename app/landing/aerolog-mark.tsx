import type { SVGProps } from 'react';
import './aerolog-mark.css';

/** Flightpath: a continuous survey route, ending at a single waypoint. */
export default function AerologMark({ className = '', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 104 54"
      width="44"
      height="28"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={`al-brand-mark ${className}`}
      {...props}
    >
      <path
        className="aerolog-mark-route"
        pathLength="1"
        d="M6 47 51 8C62-2 74 10 63 20L40 39C36 43 39 47 45 47H81C92 47 92 34 81 34H55"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <circle className="aerolog-mark-waypoint" cx="98" cy="29" r="4" fill="#85bce6" />
    </svg>
  );
}
