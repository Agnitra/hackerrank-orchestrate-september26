import { FinancialProfile, FinancialEvent, Request } from '../types';

export interface ProjectedBalance {
  date: string;
  balance: number;
}

export interface UserForecast {
  userId: string;
  projections: ProjectedBalance[];
  recurringExpenses: Map<string, { amount: number; frequencyDays: number; nextDate: string }>;
  recurringIncome: Map<string, { amount: number; frequencyDays: number; nextDate: string }>;
}

export function buildForecast(
  profile: FinancialProfile,
  events: FinancialEvent[],
  requestDate: string
): UserForecast {
  const pendingDebits = events.filter(
    e => e.status === 'pending' && e.direction === 'debit' && e.settlement_date <= requestDate
  );

  let currentBalance = profile.current_available_balance;

  for (const event of pendingDebits) {
    if (event.amount !== null) {
      currentBalance -= event.amount;
    }
  }

  const futureCredits = events.filter(
    e => e.status === 'settled' && e.direction === 'credit' && e.settlement_date > requestDate
  );
  const futureDebits = events.filter(
    e => e.status === 'settled' && e.direction === 'debit' && e.settlement_date > requestDate
  );

  const recurringExpenses = buildRecurringMap(
    events.filter(e => e.direction === 'debit' && e.status === 'settled')
  );
  const recurringIncome = buildRecurringMap(
    events.filter(e => e.direction === 'credit' && e.status === 'settled')
  );

  const projections: ProjectedBalance[] = [];
  const startDate = new Date(requestDate);
  const maxDays = 90;
  let projBalance = currentBalance;

  const sortedCredits = futureCredits
    .sort((a, b) => new Date(a.settlement_date).getTime() - new Date(b.settlement_date).getTime());
  const sortedDebits = futureDebits
    .sort((a, b) => new Date(a.settlement_date).getTime() - new Date(b.settlement_date).getTime());

  let ci = 0;
  let di = 0;

  for (let day = 0; day <= maxDays; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().slice(0, 10);

    while (ci < sortedCredits.length) {
      const credit = sortedCredits[ci];
      if (!credit || credit.settlement_date > dateStr) break;
      if (credit.amount !== null) {
        projBalance += credit.amount;
      }
      ci++;
    }
    while (di < sortedDebits.length) {
      const debit = sortedDebits[di];
      if (!debit || debit.settlement_date > dateStr) break;
      if (debit.amount !== null) {
        projBalance -= debit.amount;
      }
      di++;
    }

    projections.push({ date: dateStr, balance: projBalance });
  }

  return {
    userId: profile.user_id,
    projections,
    recurringExpenses,
    recurringIncome,
  };
}

function buildRecurringMap(events: FinancialEvent[]): Map<string, { amount: number; frequencyDays: number; nextDate: string }> {
  const result = new Map<string, { amount: number; frequencyDays: number; nextDate: string }>();
  const byCategory = new Map<string, FinancialEvent[]>();

  for (const event of events) {
    if (!event.is_recurring) continue;
    if (event.amount === null) continue;
    if (!byCategory.has(event.category)) byCategory.set(event.category, []);
    byCategory.get(event.category)!.push(event);
  }

  for (const [category, catEvents] of byCategory) {
    if (catEvents.length < 2) continue;
    const sorted = catEvents.sort(
      (a, b) => new Date(a.settlement_date).getTime() - new Date(b.settlement_date).getTime()
    );
    const totalAmount = sorted.reduce((sum, e) => sum + (e.amount ?? 0), 0);
    const avgAmount = totalAmount / sorted.length;

    const dates = sorted.map(e => new Date(e.settlement_date).getTime());
    const diffs: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      const diff = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
      if (diff > 0) diffs.push(diff);
    }
    const freqDays = diffs.length > 0 ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length) : 30;

    const lastDate = sorted[sorted.length - 1].settlement_date;

    result.set(category, {
      amount: avgAmount,
      frequencyDays: freqDays,
      nextDate: lastDate,
    });
  }

  return result;
}

export function getBalanceOnDate(projections: ProjectedBalance[], date: string): number {
  const proj = projections.find(p => p.date === date);
  return proj ? proj.balance : 0;
}

export function getBalanceAt(projections: ProjectedBalance[], date: string): number {
  let balance = projections[0]?.balance ?? 0;
  for (const p of projections) {
    if (p.date > date) break;
    balance = p.balance;
  }
  return balance;
}