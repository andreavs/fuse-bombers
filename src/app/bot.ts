import { isLoaded, type RoundView } from "../engine/index.js";

/**
 * A bot plays one player slot with the same one button a human has: called once per engine step with the
 * read-only view, it returns whether its button goes down on that step.
 */
export type Bot = (view: RoundView, playerId: number) => boolean;

/**
 * Placeholder until the real bot (#4): once loaded, waits a random 0.2–1.7 s and fires wherever the launcher
 * points. One instance can play several slots.
 */
export function createPlaceholderBot(random: () => number = Math.random): Bot {
  const pressAt = new Map<number, number>();
  return (view, id) => {
    const castle = view.castles[id];
    if (!castle || view.result || !isLoaded(castle)) {
      pressAt.delete(id);
      return false;
    }
    const at = pressAt.get(id) ?? view.tick + 12 + Math.floor(random() * 90);
    pressAt.set(id, at);
    if (view.tick < at) return false;
    pressAt.delete(id);
    return true;
  };
}
