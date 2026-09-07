/**
 * Icon set.
 *
 * Odoo's backend uses FontAwesome. Rather than pull a webfont into a CSP-tight
 * prototype, these are the handful of glyphs the application actually needs,
 * drawn as inline SVG at the same 1em optical weight.
 */

interface IconProps {
  className?: string;
  size?: number;
  title?: string;
}

function svgProps({ size = 14, className, title }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "currentColor",
    className,
    "aria-hidden": title ? undefined : (true as const),
    role: title ? ("img" as const) : undefined,
    focusable: "false" as const,
  };
}

export function IconSearch(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M6.5 1a5.5 5.5 0 014.38 8.83l4.14 4.15-1.06 1.06-4.15-4.14A5.5 5.5 0 116.5 1zm0 1.5a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  );
}

export function IconClose(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M4.28 3.22L8 6.94l3.72-3.72 1.06 1.06L9.06 8l3.72 3.72-1.06 1.06L8 9.06l-3.72 3.72-1.06-1.06L6.94 8 3.22 4.28z" />
    </svg>
  );
}

export function IconChevronDown(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M3.5 5.75L8 10.25l4.5-4.5-1.06-1.06L8 8.13 4.56 4.69z" />
    </svg>
  );
}

export function IconChevronRight(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M5.75 12.5l4.5-4.5-4.5-4.5-1.06 1.06L8.13 8l-3.44 3.44z" />
    </svg>
  );
}

export function IconChevronLeft(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M10.25 3.5L5.75 8l4.5 4.5 1.06-1.06L7.87 8l3.44-3.44z" />
    </svg>
  );
}

export function IconGrid(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M2 2h3.2v3.2H2zm5.4 0h3.2v3.2H7.4zm5.4 0H16v3.2h-3.2zM2 6.4h3.2v3.2H2zm5.4 0h3.2v3.2H7.4zm5.4 0H16v3.2h-3.2zM2 10.8h3.2V14H2zm5.4 0h3.2V14H7.4zm5.4 0H16V14h-3.2z" />
    </svg>
  );
}

export function IconList(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M1 2.5h2v2H1zm3.5 0H15v2H4.5zM1 7h2v2H1zm3.5 0H15v2H4.5zM1 11.5h2v2H1zm3.5 0H15v2H4.5z" />
    </svg>
  );
}

export function IconChart(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M1.5 13.5V9h3v4.5zm5-11h3v11h-3zm5 4h3v7h-3z" />
    </svg>
  );
}

export function IconPivot(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M1.5 1.5h13v3h-13zm0 4.5h4v8h-4zm5 0h8v3.5h-8zm0 4.5h8v3.5h-8z" />
    </svg>
  );
}

export function IconMap(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M5.6 1.6L1 3.3v11.1l4.6-1.7 4.8 1.7 4.6-1.7V1.6l-4.6 1.7zm0 1.6l3.4 1.2v8.4L5.6 11.6zM1.6 4.4l3-1.1v8.3l-3 1.1zm11.8 7.2l-3 1.1V4.4l3-1.1z" />
    </svg>
  );
}

export function IconStar(p: IconProps & { filled?: boolean }) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      {p.filled ? (
        <path d="M8 1.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.3l-3.8 2 .7-4.3-3.1-3 4.3-.6z" />
      ) : (
        <path d="M8 1.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.3l-3.8 2 .7-4.3-3.1-3 4.3-.6zm0 2.6L6.8 6.6l-2.7.4 2 1.9-.5 2.7L8 10.3l2.4 1.3-.5-2.7 2-1.9-2.7-.4z" />
      )}
    </svg>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M7.25 2.5h1.5v4.75H13.5v1.5H8.75V13.5h-1.5V8.75H2.5v-1.5h4.75z" />
    </svg>
  );
}

export function IconMinus(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M2.5 7.25h11v1.5h-11z" />
    </svg>
  );
}

export function IconDownload(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M7.25 1.5h1.5v6.19l2.22-2.22 1.06 1.06L8 11.56 3.97 6.53l1.06-1.06 2.22 2.22zM2.5 12h11v1.5h-11z" />
    </svg>
  );
}

export function IconLink(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M6.9 9.1a2.6 2.6 0 003.7 0l2.4-2.4a2.6 2.6 0 10-3.7-3.7l-1 1 1.1 1.1 1-1a1.05 1.05 0 111.5 1.5L9.5 8a1.05 1.05 0 01-1.5 0zm2.2-2.2a2.6 2.6 0 00-3.7 0L3 9.3a2.6 2.6 0 103.7 3.7l1-1-1.1-1.1-1 1a1.05 1.05 0 11-1.5-1.5L6.5 8a1.05 1.05 0 011.5 0z" />
    </svg>
  );
}

export function IconInfo(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M8 1.5a6.5 6.5 0 110 13 6.5 6.5 0 010-13zm0 1.5a5 5 0 100 10A5 5 0 008 3zm-.75 3.75h1.5v4.5h-1.5zm0-2.25h1.5v1.5h-1.5z" />
    </svg>
  );
}

export function IconWarning(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M8 1.5l7 12.5H1zm0 3.1L3.6 12.5h8.8zM7.25 7h1.5v3h-1.5zm0 3.75h1.5v1.25h-1.5z" />
    </svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M13.6 3.7l1.1 1.1-8 8-4.4-4.4 1.1-1.1 3.3 3.3z" />
    </svg>
  );
}

export function IconSettings(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M8 5.4A2.6 2.6 0 108 10.6 2.6 2.6 0 008 5.4zm0 1.5a1.1 1.1 0 110 2.2 1.1 1.1 0 010-2.2z" />
      <path d="M6.9 1h2.2l.3 1.7 1 .6 1.6-.7 1.5 1.6-.9 1.5.3 1.1 1.7.4v2.2l-1.7.3-.4 1 .8 1.6-1.6 1.5-1.5-.9-1.1.3-.4 1.7H6.9l-.3-1.7-1-.4-1.6.8-1.5-1.6.9-1.5-.4-1.1L1.3 9.1V6.9l1.7-.3.4-1-.8-1.6 1.6-1.5 1.5.9 1.1-.4zm1 1.5l-.2 1.4-1.9.8-1.2-.7-.3.3.7 1.3-.8 1.9-1.4.2v.6l1.4.2.8 1.9-.7 1.2.3.3 1.3-.7 1.9.8.2 1.4h.6l.2-1.4 1.9-.8 1.2.7.3-.3-.7-1.3.8-1.9 1.4-.2v-.6l-1.4-.2-.8-1.9.7-1.2-.3-.3-1.3.7-1.9-.8-.2-1.4z" />
    </svg>
  );
}

export function IconPallet(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M1.5 2h13v6h-13zm1.5 1.5v3h10v-3zM1 10h2v2h4v-2h2v2h4v-2h2v3.5H1z" />
    </svg>
  );
}

export function IconArrowRight(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M8.6 2.9l5.1 5.1-5.1 5.1-1.06-1.06 3.29-3.29H2.3v-1.5h8.53L7.54 3.96z" />
    </svg>
  );
}

export function IconRefresh(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      {p.title && <title>{p.title}</title>}
      <path d="M8 2.5a5.5 5.5 0 014.9 3H14.5L12 9 9.5 5.5h1.8A4 4 0 108 12v1.5A5.5 5.5 0 118 2.5z" />
    </svg>
  );
}
