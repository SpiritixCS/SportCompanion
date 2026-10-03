// Au-delà de ce trou entre deux événements, la séance est considérée en pause :
// le trou ne compte pas dans la durée et le player propose Reprendre/Terminer/Effacer.
export const INACTIVITY_LIMIT_SECONDS = 3600;

function sortedMs(events: (string | null | undefined)[]): number[] {
  return events
    .filter((e): e is string => typeof e === "string")
    .map((e) => Date.parse(e))
    .sort((a, b) => a - b);
}

export function activeDurationSeconds(events: (string | null | undefined)[], nowMs: number): number {
  const times = sortedMs(events);
  if (times.length === 0) return 0;
  times.push(nowMs);
  let total = 0;
  for (let i = 1; i < times.length; i++) {
    const gap = (times[i]! - times[i - 1]!) / 1000;
    if (gap > 0 && gap <= INACTIVITY_LIMIT_SECONDS) total += gap;
  }
  return Math.floor(total);
}

export function isInactive(events: (string | null | undefined)[], nowMs: number): boolean {
  const times = sortedMs(events);
  if (times.length === 0) return false;
  return (nowMs - times[times.length - 1]!) / 1000 > INACTIVITY_LIMIT_SECONDS;
}
