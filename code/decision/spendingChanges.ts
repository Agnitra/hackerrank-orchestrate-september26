import { FinancialEvent } from '../types';
import { formatNum } from '../currency/convert';

export interface SpendingChange {
  type: 'stop' | 'reduce_to';
  eventId: string;
  newAmount?: number;
}

export function suggestSpendingChanges(
  events: FinancialEvent[],
  protectedCategories: string[],
  reduceCategories: string[],
  stopCategories: string[],
  neededSavings: number,
  maxChanges: number = 3
): SpendingChange[] {
  const changes: SpendingChange[] = [];
  let saved = 0;

  const stoppable = events
    .filter(e => stopCategories.includes(e.category) && e.flexibility === 'stoppable')
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));

  for (const event of stoppable) {
    if (saved >= neededSavings || changes.length >= maxChanges) break;
    changes.push({ type: 'stop', eventId: event.event_id });
    saved += event.amount ?? 0;
  }

  if (saved < neededSavings) {
    const reducible = events
      .filter(e => reduceCategories.includes(e.category) && (e.flexibility === 'reducible' || e.flexibility === 'reducible_or_stoppable'))
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));

    for (const event of reducible) {
      if (saved >= neededSavings || changes.length >= maxChanges) break;
      const remaining = neededSavings - saved;
      const minAllowed = event.minimum_allowed_amount ?? 0;
      const currentAmount = event.amount ?? 0;
      const newAmount = Math.max(minAllowed, currentAmount - remaining);
      const reduction = currentAmount - newAmount;
      if (reduction > 0) {
        changes.push({ type: 'reduce_to', eventId: event.event_id, newAmount });
        saved += reduction;
      }
    }
  }

  return changes;
}

export function formatSpendingChanges(changes: SpendingChange[]): string {
  if (changes.length === 0) return 'none';
  return changes.map(c => {
    if (c.type === 'stop') return `stop:${c.eventId}`;
    return `reduce_to:${c.eventId}:${c.newAmount !== undefined ? formatNum(c.newAmount) : '0'}`;
  }).join('|');
}