// Minimal inline icon set (no external icon library in this project yet).
// Each icon is a plain stroke-based SVG, 24x24, using currentColor so it
// inherits whatever text color the parent button applies.

const base = {
  width: "1em",
  height: "1em",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function HomeIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H9.5a1 1 0 0 0 1-1v-4.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V19a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function BedIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7" />
      <path d="M3 18v2M21 18v2" />
      <path d="M3 13V8a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v3" />
      <path d="M14 10.5h4a2 2 0 0 1 2 2V13" />
    </svg>
  );
}

export function ClipboardIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="4.5" width="14" height="17" rx="2" />
      <path d="M9 4.5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v.5" />
      <path d="M8.5 11h7M8.5 15h7M8.5 19h4" />
    </svg>
  );
}

export function FlagIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 21V4" />
      <path d="M5 4.5s1.4-1 3.5-1 3 1 5 1 3.5-1 3.5-1v9s-1.4 1-3.5 1-3-1-5-1-3.5 1-3.5 1" />
    </svg>
  );
}

export function ClockIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function LogoutIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M16 16l4-4-4-4" />
      <path d="M20 12H9" />
    </svg>
  );
}

export function SwitchIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 7h11l-3-3M17 17H6l3 3" />
    </svg>
  );
}

export function DollarIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2v20" />
      <path d="M16.5 6.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.7 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3" />
    </svg>
  );
}

export function WrenchIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.6 2.6-2-2z" />
    </svg>
  );
}

export function HistoryIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 8v4.5l3 2" />
    </svg>
  );
}

export const NAV_ICONS = {
  home: HomeIcon,
  rooms: BedIcon,
  status: ClipboardIcon,
  complaint: FlagIcon,
  curfew: ClockIcon,
  payments: DollarIcon,
  tasks: WrenchIcon,
  history: HistoryIcon,
};
