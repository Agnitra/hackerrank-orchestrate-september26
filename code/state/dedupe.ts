import { FinancialEvent } from '../types';

export interface DeduplicatedEvent {
  event: FinancialEvent;
  isDuplicate: boolean;
  isCancelled: boolean;
  isAmended: boolean;
}

export function dedupeEvents(events: FinancialEvent[]): FinancialEvent[] {
  const byLinked: Map<string, FinancialEvent[]> = new Map();
  const standalone: FinancialEvent[] = [];

  for (const event of events) {
    if (event.linked_event_id) {
      if (!byLinked.has(event.linked_event_id)) byLinked.set(event.linked_event_id, []);
      byLinked.get(event.linked_event_id)!.push(event);
    } else {
      standalone.push(event);
    }
  }

  const result: FinancialEvent[] = [];

  for (const [, group] of byLinked) {
    const settled = group.find(e => e.status === 'settled' || e.status === 'scheduled');
    const cancelled = group.find(e => e.status === 'cancelled' || e.status === 'failed');

    if (cancelled && settled) {
      result.push(settled!);
    } else if (settled) {
      result.push(settled);
    } else {
      const sorted = [...group].sort((a, b) => new Date(b.settlement_date).getTime() - new Date(a.settlement_date).getTime());
      result.push(sorted[0]);
    }
  }

  for (const event of standalone) {
    if (event.status === 'cancelled' || event.status === 'failed') continue;
    result.push(event);
  }

  const categoryEvents: Map<string, FinancialEvent[]> = new Map();
  for (const event of result) {
    if (event.direction === 'debit') {
      if (!categoryEvents.has(event.category)) categoryEvents.set(event.category, []);
      categoryEvents.get(event.category)!.push(event);
    }
  }

  for (const event of result) {
    const catEvents = categoryEvents.get(event.category);
    if (catEvents && catEvents.length >= 2) {
      event.is_recurring = true;
    }
  }

  return result;
}