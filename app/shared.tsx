import type React from 'react';
export function Status({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={
        'status ' +
        (String(children).match(/Pending|Review|due|Attention/)
          ? 'amber'
          : String(children).match(/Draft|Disconnected/)
            ? 'gray'
            : 'green')
      }
    >
      <i />
      {children}
    </span>
  );
}
export function Airspace() {
  return (
    <div className="airspace">
      <div className="map-grid" />
      <svg
        viewBox="0 0 800 330"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label="Illustrative Dubai mission airspace and planned survey path"
      >
        <defs>
          <pattern
            id="blocks"
            width="82"
            height="61"
            patternTransform="rotate(-26)"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M4 4H72V51H4Z"
              fill="#243537"
              stroke="#334649"
              strokeWidth="1"
            />
            <path d="M15 13H35V37H15ZM42 13H64V37H42Z" fill="#2a3d3f" />
          </pattern>
        </defs>
        <rect width="800" height="330" fill="#13292d" />
        <path
          d="M200 -40L550 -40L860 250L590 390L340 230Z"
          fill="url(#blocks)"
        />
        <path
          d="M240 -40L365 155L660 350M370 -20L500 130L790 20M400 200L720 30"
          fill="none"
          stroke="#527071"
          strokeWidth="5"
          opacity=".55"
        />
        <path
          d="M100 50Q270 230 455 330"
          fill="none"
          stroke="#456063"
          strokeWidth="2"
        />
        <path
          d="M350 125L520 72L641 186L466 247Z"
          fill="#c9ef6120"
          stroke="#c9ef61"
          strokeDasharray="5 6"
        />
        <path
          d="M374 134L485 231L500 216L394 119L415 111L521 205L542 197L436 103L458 96L566 187L584 177L480 88L511 83L619 182"
          fill="none"
          stroke="#c9ef61"
          strokeWidth="2"
        />
        <circle cx="466" cy="166" r="19" fill="#c9ef6120" stroke="#c9ef6150" />
        <circle cx="466" cy="166" r="6" fill="#d9fd85" />
        <text
          x="72"
          y="190"
          fill="#79999c"
          fontSize="15"
          letterSpacing="5"
          transform="rotate(-28 72 190)"
        >
          ARABIAN GULF
        </text>
        <text x="570" y="100" fill="#93a9a8" fontSize="12" letterSpacing="2">
          DUBAI MARINA
        </text>
      </svg>
      <span className="map-tag">
        <i /> Mission area <b>DXB–024</b>
      </span>
      <span className="map-scale">Illustrative map · 200 m ━━━</span>
      <div className="map-compass">
        N<br />↑
      </div>
    </div>
  );
}
