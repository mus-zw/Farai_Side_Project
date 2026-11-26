/**
 * Interest tags a visitor can pick, and the section each one points at.
 * Pure data and helpers: no DOM, no React.
 */

export type InterestId = 'cv' | 'fitness';

export interface InterestInfo {
  id: InterestId;
  label: string;
  path: string;
  blurb: string;
}

export const INTERESTS: readonly InterestInfo[] = [
  {
    id: 'cv',
    label: 'Computer Vision',
    path: '/demo',
    blurb: 'Detect objects in images and video, in your browser or on the backend.',
  },
  {
    id: 'fitness',
    label: 'Fitness',
    path: '/fitness',
    blurb: 'Push/Pull/Legs plan, a lift logger, and a daily calorie and protein tracker.',
  },
];

export function isInterestId(v: unknown): v is InterestId {
  return INTERESTS.some((i) => i.id === v);
}

/**
 * Items whose interest the visitor picked come first, in the order they picked
 * them; everything else keeps its original order after them. Items with no
 * `interest` (Home, About, ...) are never moved: pass only the reorderable ones.
 */
export function orderByInterests<T extends { interest?: InterestId }>(items: readonly T[], selected: readonly InterestId[]): T[] {
  const rank = (item: T) => {
    const i = item.interest ? selected.indexOf(item.interest) : -1;
    return i === -1 ? Infinity : i;
  };
  return items
    .map((item, index) => ({ item, index, rank: rank(item) }))
    .sort((a, b) => (a.rank === b.rank ? a.index - b.index : a.rank - b.rank))
    .map((x) => x.item);
}
