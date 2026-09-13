export function enforceMinBalance(projections: any[], minBalance: number, maxDays: number = 90): any[] {
  return projections.filter((p: any) => {
    const daysFromStart = Math.round((new Date(p.date).getTime() - projections[0].date.getTime()) / (1000 * 60 * 60 * 24));
    return daysFromStart <= maxDays;
  }).map((p: any) => ({ date: p.date, balance: Math.max(p.balance, minBalance) }));
}

export function isSafeBalance(projections: any[], minBalance: number): boolean {
  return projections.every((p: any) => p.balance >= minBalance - 0.01);
}

export function findEarliestSafeDate(projections: any[], targetAmount: number, minBalance: number, startDate: string): string | null {
  for (const p of projections) {
    const daysDiff = Math.round((new Date(p.date).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 0) continue;
    if (p.balance >= minBalance + targetAmount) {
      return p.date;
    }
  }
  return null;
}