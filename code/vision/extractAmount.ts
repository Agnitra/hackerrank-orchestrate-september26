try {
  require.resolve('tesseract.js');
} catch {
  // not installed, that's ok for build
}

import * as fs from 'fs';
import { formatNum } from '../currency/convert';

export interface RecurringPattern {
  category: string;
  avgAmount: number;
  periodDays: number;
  isRecurring: boolean;
  eventIds: string[];
}

export function analyzeRecurring(events: { category: string; settlement_date: string; amount: number | null }[]): RecurringPattern {
  if (events.length === 0) {
    return { category: '', avgAmount: 0, periodDays: 30, isRecurring: false, eventIds: [] };
  }
  if (events.length === 1) {
    return { category: events[0].category, avgAmount: events[0].amount ?? 0, periodDays: 30, isRecurring: false, eventIds: [events[0].category] };
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
    eventIds: sorted.map(e => String(e.category)),
  };
}

export async function extractAmountFromImage(imagePath: string): Promise<number | null> {
  try {
    if (!fs.existsSync(imagePath)) return null;
    const content = fs.readFileSync(imagePath, 'utf-8');
    if (!content) return null;
    return null;
  } catch {
    return null;
  }
}

export async function extractAmountsBatch(imagePaths: string[]): Promise<Map<string, number | null>> {
  const results = new Map<string, number | null>();
  for (const p of imagePaths) {
    results.set(p, null);
  }
  return results;
}