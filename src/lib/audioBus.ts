/**
 * pass 40 — GLOBAL audio exclusivity: when one registered player starts
 * (ruqyah, adhan, recitations, the shared content player…), every OTHER
 * registered player is stopped. "Playing one stops the others."
 */
type Stop = () => void;
const registry = new Map<string, Stop>();

/** register a stopper; returns an unregister fn */
export function registerAudioStop(owner: string, stop: Stop): () => void {
  registry.set(owner, stop);
  return () => {
    if (registry.get(owner) === stop) registry.delete(owner);
  };
}

/** stop every OTHER registered player (call right before you start) */
export function claimExclusiveAudio(owner: string): void {
  for (const [k, stop] of registry) {
    if (k === owner) continue;
    try { stop(); } catch {}
  }
}
