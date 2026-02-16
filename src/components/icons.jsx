import React from "react";

// Minimal inline SVG icon set (no extra deps)

export function IconKanban({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6.5C4 5.11929 5.11929 4 6.5 4H9.5C10.8807 4 12 5.11929 12 6.5V17.5C12 18.8807 10.8807 20 9.5 20H6.5C5.11929 20 4 18.8807 4 17.5V6.5Z" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M12 6.5C12 5.11929 13.1193 4 14.5 4H17.5C18.8807 4 20 5.11929 20 6.5V10.5C20 11.8807 18.8807 13 17.5 13H14.5C13.1193 13 12 11.8807 12 10.5V6.5Z" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M12 15.5C12 14.1193 13.1193 13 14.5 13H17.5C18.8807 13 20 14.1193 20 15.5V17.5C20 18.8807 18.8807 20 17.5 20H14.5C13.1193 20 12 18.8807 12 17.5V15.5Z" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  );
}

export function IconChart({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 20V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M4 20H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M7 16L11 12L14 14L19 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconHistory({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 12a8 8 0 1 0 3.2-6.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M4 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconDollar({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2v20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M16.5 7.5c0-2-1.9-3.5-4.5-3.5S7.5 5.5 7.5 7.5s1.9 3.5 4.5 3.5 4.5 1.5 4.5 3.5-1.9 3.5-4.5 3.5-4.5-1.5-4.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

export function IconLogout({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 7V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M4 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M7 9l-3 3 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
