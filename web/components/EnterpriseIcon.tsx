"use client";

type EnterpriseIconProps = {
  name:
    | "dashboard"
    | "calendar"
    | "estimator"
    | "sales"
    | "crm"
    | "operations"
    | "contacts"
    | "jobs"
    | "workOrders"
    | "erp"
    | "invoices"
    | "procurements"
    | "users"
    | "profile"
    | "vendors"
    | "settings"
    | "search"
    | "refresh"
    | "notifications"
    | "support"
    | "shield"
    | "insight"
    | "roadmap"
    | "themeLight"
    | "themeDark"
    | "themeAuto"
    | "ai"
    | "integrations"
    | "finance"
    | "upload";
  className?: string;
};

const iconPaths: Record<EnterpriseIconProps["name"], React.ReactNode> = {
  dashboard: <path d="M3 3h8v8H3V3Zm10 0h8v5h-8V3ZM3 13h5v8H3v-8Zm7 4h11v4H10v-4Z" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  estimator: (
    <>
      <path d="M4 20 20 4" />
      <path d="M6 6h5v5H6zM13 13h5v5h-5z" />
    </>
  ),
  sales: <path d="M4 18V8m5 10V4m5 14v-7m5 7V6" />,
  crm: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9h10M7 13h6" />
    </>
  ),
  operations: <path d="M12 3v4m0 10v4m9-9h-4M7 12H3m15.4 6.4-2.8-2.8M8.4 8.4 5.6 5.6m12.8 0-2.8 2.8M8.4 15.6l-2.8 2.8" />,
  contacts: (
    <>
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="10" r="2" />
      <path d="M4 20c0-2.8 2.2-5 5-5s5 2.2 5 5M14 20c.2-1.8 1.5-3.2 3.2-3.7" />
    </>
  ),
  jobs: <path d="M3 7h18v10H3zM7 7V5h10v2M10 12h4" />,
  workOrders: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </>
  ),
  erp: <path d="M4 18h16M6 14l3-3 3 2 5-5" />,
  invoices: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  procurements: <path d="M3 8h18l-2 11H5L3 8Zm4 0V6a5 5 0 0 1 10 0v2" />,
  users: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 20c0-3.1 3.1-5 7-5s7 1.9 7 5" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M4 20c0-3.2 3.6-5 8-5s8 1.8 8 5" />
      <path d="M18 6v4M16 8h4" />
    </>
  ),
  vendors: <path d="M4 7h16v4H4zM6 11h12v9H6zM9 15h6" />,
  settings: <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.4-6.4-2.1 2.1M8.7 15.3l-2.1 2.1m10.8 0-2.1-2.1M8.7 8.7 6.6 6.6M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />,
  search: <path d="m21 21-4.2-4.2M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" />,
  refresh: <path d="M20 4v6h-6M4 20v-6h6M6.5 9a7 7 0 0 1 11.5-2M17.5 15a7 7 0 0 1-11.5 2" />,
  notifications: <path d="M18 16H6l1.2-1.8c.5-.7.8-1.5.8-2.4V9a4 4 0 1 1 8 0v2.8c0 .9.3 1.7.8 2.4L18 16ZM10 18a2 2 0 0 0 4 0" />,
  support: <path d="M12 20h.01M8.5 9a3.5 3.5 0 1 1 6.1 2.3c-.9.8-1.6 1.4-1.6 2.7M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />,
  shield: <path d="M12 3 5 6v6c0 5 3.4 8 7 9 3.6-1 7-4 7-9V6l-7-3Zm0 4v8" />,
  insight: <path d="M4 18h16M7 15l3-4 3 2 4-6" />,
  roadmap: <path d="M4 7h6v4H4zM14 7h6v4h-6zM9 17h6v4H9zM10 9h4m3 2v4m-4 2V13" />,
  themeLight: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  themeDark: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  themeAuto: <path d="M4 18h16M6 14l3-3 3 2 5-5M12 4v3m0 10v3" />,
  ai: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1" />
    </>
  ),
  integrations: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M17.5 14v7M14 17.5h7" />
    </>
  ),
  finance: (
    <>
      <path d="M12 3v4m0 10v4M4.9 7.4l2.8 2.8M16.3 13.8l2.8 2.8M3 12h4m10 0h4M4.9 16.6l2.8-2.8M16.3 10.2l2.8-2.8" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </>
  ),
};

export function EnterpriseIcon({ name, className = "h-4 w-4" }: EnterpriseIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}
