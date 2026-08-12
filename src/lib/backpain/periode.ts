const MS_PER_DAY = 86_400_000;

export function computeWeek(startDate: string, today: string): number {
  const daysElapsed = Math.floor((Date.parse(today) - Date.parse(startDate)) / MS_PER_DAY);
  const week = Math.floor(daysElapsed / 7) + 1;
  return Math.min(16, Math.max(1, week));
}

export function computeBlock(week: number): number {
  return Math.min(4, Math.ceil(week / 4));
}

export function isDechargeWeek(week: number): boolean {
  return week % 4 === 0;
}

export function isCalibrageWeek(week: number): boolean {
  return week === 1;
}

export const RPE_CIBLE: readonly [number, number, number, number] = [6, 7, 8, 8];
