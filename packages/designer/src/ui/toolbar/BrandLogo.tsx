import type { ReactNode } from "react";

export function BrandLogo(): ReactNode {
  return (
    <svg
      viewBox="0 0 64 64"
      width="22"
      height="22"
      role="img"
      aria-label="denreport"
    >
      <rect x="0" y="0" width="64" height="64" rx="14" fill="#222E3A" />
      <rect x="12" y="20" width="18" height="24" rx="3" fill="#FBFAF7" />
      <rect x="16" y="26" width="10" height="3" rx="1.5" fill="#222E3A" />
      <rect x="16" y="32" width="7" height="3" rx="1.5" fill="#222E3A" />
      <path
        d="M 30 32 H 38 M 38 32 C 43 32, 43 24, 48 24 M 38 32 C 43 32, 43 40, 48 40"
        fill="none"
        stroke="#FBFAF7"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="46" y="18" width="12" height="12" rx="3" fill="#C93A22" />
      <rect x="46" y="34" width="12" height="12" rx="3" fill="#C93A22" />
    </svg>
  );
}
