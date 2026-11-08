import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 10.7 12 3.8l8.5 6.9" />
      <path d="M5.5 9.5v9.2a1.3 1.3 0 0 0 1.3 1.3h10.4a1.3 1.3 0 0 0 1.3-1.3V9.5" />
      <path d="M9.7 20v-5.4h4.6V20" />
    </Icon>
  );
}

export function BriefcaseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="7.3" width="18" height="12.7" rx="2.2" />
      <path d="M8.5 7.3V5.8a1.8 1.8 0 0 1 1.8-1.8h3.4a1.8 1.8 0 0 1 1.8 1.8v1.5" />
      <path d="M3 12.2c2.8 1.4 5.8 2.1 9 2.1s6.2-.7 9-2.1" />
      <path d="M10.7 14.3h2.6" />
    </Icon>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9.2" cy="8.2" r="3.2" />
      <path d="M3.7 19.8c.5-3.1 2.6-5 5.5-5s5 1.9 5.5 5" />
      <path d="M16.2 5.7a3 3 0 0 1 0 5.5" />
      <path d="M17.4 14.5c1.8.6 2.9 2.4 3.2 4.6" />
    </Icon>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5Z" />
      <path d="M4 8.3h16" />
      <path d="M15 13.3h5v3.2h-5a1.6 1.6 0 0 1 0-3.2Z" />
      <path d="M7.5 13.5h3" />
    </Icon>
  );
}

export function BoxIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 3.6 8 4.1v8.6l-8 4.1-8-4.1V7.7Z" />
      <path d="m4.3 7.9 7.7 4 7.7-4" />
      <path d="M12 11.9v8.3" />
      <path d="m8 5.7 8 4.1" />
    </Icon>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.6 11.4V5.6A1.1 1.1 0 0 1 5.7 4.5h5.8c.3 0 .59.12.81.33l6.27 6.27a1.15 1.15 0 0 1 0 1.63l-5.24 5.24a1.15 1.15 0 0 1-1.63 0L4.93 12.21A1.1 1.1 0 0 1 4.6 11.4Z" />
      <circle cx="8.7" cy="8.7" r="1.35" />
    </Icon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.6a7.8 7.8 0 0 0 .1-1.6 7.8 7.8 0 0 0-.1-1.6l1.8-1.4-1.9-3.3-2.1.9a8 8 0 0 0-2.8-1.6L14.1 2h-3.8l-.3 2.3a8 8 0 0 0-2.8 1.6l-2.1-.9-1.9 3.3 1.8 1.4a7.8 7.8 0 0 0-.1 1.6 7.8 7.8 0 0 0 .1 1.6L3.2 14.4l1.9 3.3 2.1-.9a8 8 0 0 0 2.8 1.6l.3 2.3h3.8l.3-2.3a8 8 0 0 0 2.8-1.6l2.1.9 1.9-3.3Z" />
    </Icon>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 8.2V6.5a2 2 0 0 0-2-2H6.8a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h5.7a2 2 0 0 0 2-2v-1.7" />
      <path d="M10.5 12h9" />
      <path d="m16.5 9 3 3-3 3" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.3 4.3L19 7.2" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.3" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
      <path d="M12 14.5v2.2" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.2 19 6v5.4c0 4.3-2.8 7.4-7 9.4-4.2-2-7-5.1-7-9.4V6Z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

export function LedgerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 3.8h11.5A1.5 1.5 0 0 1 19 5.3v13.4a1.5 1.5 0 0 1-1.5 1.5H6" />
      <path d="M6 3.8A2.2 2.2 0 0 0 3.8 6v12a2.2 2.2 0 0 0 2.2 2.2" />
      <path d="M7.5 8h7" />
      <path d="M7.5 11.5h7" />
      <path d="M7.5 15h4.5" />
    </Icon>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9Z" />
      <path d="m18.5 16 .7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7Z" />
    </Icon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m14.5 6-6 6 6 6" />
    </Icon>
  );
}

export function DatabaseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <ellipse cx="12" cy="5.6" rx="7.5" ry="2.8" />
      <path d="M4.5 5.6v6.1c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V5.6" />
      <path d="M4.5 11.7v6.1c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6.1" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4.5v14.2a1.3 1.3 0 0 0 1.3 1.3H20" />
      <path d="M8 16.5v-4.2" />
      <path d="M12.4 16.5V8.2" />
      <path d="M16.8 16.5v-6.2" />
    </Icon>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.8v10.6" />
      <path d="m7.8 10.6 4.2 4.2 4.2-4.2" />
      <path d="M4.5 17.2v1.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1.5" />
    </Icon>
  );
}

export function PrintIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 8V4.5h10V8" />
      <rect x="3.8" y="8" width="16.4" height="8.2" rx="2" />
      <path d="M7 13h10v7H7Z" />
      <path d="M17.5 11h.01" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4.2 21 20H3Z" />
      <path d="M12 9.5v4.3" />
      <path d="M12 17.1h.01" />
    </Icon>
  );
}
