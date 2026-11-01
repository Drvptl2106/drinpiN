// Line icons used across the app (drawn for drinpiN, 24×24 grid).
import type { ReactNode } from 'react';

function Icon({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      {children}
    </svg>
  );
}

export const IconGrid = () => <Icon><rect x="4" y="4" width="7" height="9" rx="2" /><rect x="13" y="4" width="7" height="5" rx="2" /><rect x="4" y="15" width="7" height="5" rx="2" /><rect x="13" y="11" width="7" height="9" rx="2" /></Icon>;
export const IconHanger = () => <Icon><path d="M10 6.5a2 2 0 1 1 2 2V10" /><path d="M12 10 3.5 16.5h17Z" /></Icon>;
export const IconPlus = () => <Icon><path d="M12 5v14M5 12h14" /></Icon>;
export const IconSearch = () => <Icon><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Icon>;
export const IconBack = () => <Icon><path d="M15 5 8 12l7 7" /></Icon>;
export const IconClose = () => <Icon><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const IconCheck = () => <Icon><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>;
export const IconExternal = () => <Icon><path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></Icon>;
export const IconShare = () => <Icon><path d="M12 15V4M8 8l4-4 4 4" /><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></Icon>;
export const IconEdit = () => <Icon><path d="M4 20h4L19 9l-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></Icon>;
export const IconTrash = () => <Icon><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></Icon>;
export const IconChevron = () => <Icon><path d="m9 6 6 6-6 6" /></Icon>;
export const IconClipboard = () => <Icon><rect x="6" y="5" width="12" height="16" rx="2" /><path d="M9 5V3.5h6V5" /></Icon>;
