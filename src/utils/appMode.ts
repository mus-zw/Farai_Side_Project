/**
 * Which "surface" this build or hostname serves. One repo, three entry points:
 *
 *   hub      the portfolio: engineering authority, case studies, intake. The
 *            default, and what localhost and preview URLs get, so every route
 *            (/, /demo, /fitness) stays reachable while developing.
 *   lab      the CV Auto-Labeler on its own (lab.<domain>): `/` opens /demo.
 *   fitness  the standalone fitness app (its own domain): `/` opens /fitness.
 *
 * Chosen by VITE_APP_MODE when set (the right tool for separate Cloudflare Pages
 * projects, which build once per surface), otherwise by hostname. Pure: no
 * import.meta and no window, so it can be tested.
 */

export type AppMode = 'hub' | 'lab' | 'fitness';
export type Tool = 'hub' | 'lab' | 'fitness';

export function parseMode(v: unknown): AppMode | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return s === 'hub' || s === 'lab' || s === 'fitness' ? s : null;
}

const hostList = (v?: string) =>
  (v ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

export interface ResolveOptions {
  envMode?: string;
  hostname: string;
  /** Comma-separated hostnames that mean "lab" / "fitness", on top of the lab.* / fitness.* convention. */
  labHosts?: string;
  fitnessHosts?: string;
}

export function resolveAppMode({ envMode, hostname, labHosts, fitnessHosts }: ResolveOptions): AppMode {
  const forced = parseMode(envMode);
  if (forced) return forced;
  const host = hostname.trim().toLowerCase();
  if (hostList(labHosts).includes(host) || host.startsWith('lab.')) return 'lab';
  if (hostList(fitnessHosts).includes(host) || host.startsWith('fitness.')) return 'fitness';
  return 'hub';
}

/** The path each tool lives at inside its own site. */
export const TOOL_PATH: Record<Tool, string> = { hub: '/', lab: '/demo', fitness: '/fitness' };

/** The surface a given mode's site IS (a spoke is its own tool; the hub is the hub). */
export const MODE_TOOL: Record<AppMode, Tool> = { hub: 'hub', lab: 'lab', fitness: 'fitness' };

export interface ToolLink {
  /** Absolute URL when the tool lives on another site, else an in-app path. */
  href: string;
  external: boolean;
}

/**
 * Where a link to `tool` should go from a site running in `mode`. If a base URL
 * is configured for that tool and it is not this site, the link leaves for the
 * other domain; otherwise it stays an in-app route (always true in hub mode
 * with no URLs set, which is how local development works).
 */
export function toolLink(tool: Tool, mode: AppMode, bases: Partial<Record<Tool, string>>, subPath = ''): ToolLink {
  const path = TOOL_PATH[tool] + subPath;
  const base = (bases[tool] ?? '').trim().replace(/\/+$/, '');
  const onThatSite = MODE_TOOL[mode] === tool && mode !== 'hub';
  if (base && !onThatSite) return { href: base + (path === '/' ? '' : path), external: true };
  // A spoke linking to the hub with no hub URL configured has nowhere honest to go but the root of its own site.
  return { href: path, external: false };
}
