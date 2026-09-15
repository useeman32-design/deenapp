/* Cross-surface post invalidation. A successful mutation updates every mounted
 * feed/profile/group surface immediately; no screen exit or refetch is needed. */
type Listener = (postId: number) => void;
const deleted = new Set<Listener>();
const changed = new Set<Listener>();
export const emitPostDeleted = (postId: number) => { deleted.forEach((fn) => fn(postId)); };
export const emitPostChanged = (postId: number) => { changed.forEach((fn) => fn(postId)); };
export const onPostDeleted = (fn: Listener) => { deleted.add(fn); return () => { deleted.delete(fn); }; };
export const onPostChanged = (fn: Listener) => { changed.add(fn); return () => { changed.delete(fn); }; };
