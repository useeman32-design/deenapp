/**
 * pass 83-31 — shared like overrides.
 *
 * Owner: "when you visit a profile the heart shows unliked even when you
 * liked it — and liking again doesn't double count." The community screen and
 * the profile screen each kept their own local Set of liked ids, so a like
 * made in one place was invisible to the other. This tiny module holds the
 * session's like intents; both screens seed from the server (`liked_by_me`)
 * and then apply these overrides on top, so both always agree.
 */

const overrides = new Map<number, boolean>();

export function likeStoreSet(id: number, liked: boolean): void {
  overrides.set(id, liked);
}

export function likeStoreGet(id: number, fallback: boolean): boolean {
  const v = overrides.get(id);
  return v === undefined ? fallback : v;
}

export function likeStoreHas(id: number): boolean {
  return overrides.has(id);
}
