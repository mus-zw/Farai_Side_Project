import { AppMode, Tool, ToolLink, resolveAppMode, toolLink } from './appMode';


/** The surface this page is serving. Resolved once at load from VITE_APP_MODE, then the hostname. */
export const APP_MODE: AppMode = resolveAppMode({
  envMode: import.meta.env.VITE_APP_MODE,
  hostname: typeof location === 'undefined' ? '' : location.hostname,
  labHosts: import.meta.env.VITE_LAB_HOSTS,
  fitnessHosts: import.meta.env.VITE_FITNESS_HOSTS,
});

const BASES: Partial<Record<Tool, string>> = {
  hub: import.meta.env.VITE_HUB_URL,
  lab: import.meta.env.VITE_LAB_URL,
  fitness: import.meta.env.VITE_FITNESS_URL,
};

export const isStandalone = APP_MODE !== 'hub';

export function linkTo(tool: Tool, subPath = ''): ToolLink {
  return toolLink(tool, APP_MODE, BASES, subPath);
}

/** The "Engineered by" credit target: the hub, wherever it lives. */
export function hubHomeLink(): ToolLink {
  return linkTo('hub');
}

/** Business contact for intake. Defaults to the address the Contact page already publishes. */
export const CONTACT_EMAIL: string = (import.meta.env.VITE_CONTACT_EMAIL || 'fbmfari@gmail.com').trim();
/** Optional booking page (Calendly, Cal.com...) for the 20-minute discovery call. */
export const BOOKING_URL: string = (import.meta.env.VITE_BOOKING_URL || '').trim();
