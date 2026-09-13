import { FinancialProfile, FinancialEvent, Request, RequestPaymentOption } from '../types';

export interface RecurringInfo {
  category: string;
  avgAmount: number;
  periodDays: number;
  isRecurring: boolean;
}

export function analyzeRecurring(events: { category: string; settlement_date: string; amount: number | null }[]): RecurringInfo {
  if (events.length === 0) {
    return { category: '', avgAmount: 0, periodDays: 30, isRecurring: false };
  }
  if (events.length === 1) {
    return { category: events[0].category, avgAmount: events[0].amount ?? 0, periodDays: 30, isRecurring: false };
  }
  const sorted = [...events].sort((a, b) => new Date(a.settlement_date).getTime() - new Date(b.settlement_date).getTime());
  const dates = sorted.map(e => new Date(e.settlement_date).getTime());
  const diffs: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const diff = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
    if (diff > 0) diffs.push(diff);
  }
  const avgDiff = diffs.length > 0 ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 30;
  const amounts = sorted.map(e => e.amount ?? 0);
  const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  return {
    category: events[0].category,
    avgAmount,
    periodDays: Math.round(avgDiff),
    isRecurring: true,
  };
}

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