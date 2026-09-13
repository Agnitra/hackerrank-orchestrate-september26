import * as fs from 'fs';
import * as path from 'path';
import { FinancialProfile, FinancialEvent, ExchangeRate, Request, RequestPaymentOption, Message, ImageRecord } from '../types';
import { readCsvAsObjects, resolveDatasetPath } from '../io/loadCsv';
import { dedupeEvents } from '../state/dedupe';
import { extractAmountFromImage } from '../currency/convert';

const PROFILE_FIELDS: (keyof FinancialProfile)[] = [
  'user_id', 'home_currency', 'current_available_balance', 'minimum_balance_to_keep',
  'financial_priorities', 'expense_categories_to_protect', 'expense_categories_user_is_willing_to_reduce',
  'expense_categories_user_is_willing_to_stop', 'payment_methods_user_will_consider', 'max_installment_months'
];

export function loadFinancialProfiles(): Map<string, FinancialProfile> {
  const rows = readCsvAsObjects<FinancialProfile>(resolveDatasetPath('financial_profiles.csv'), PROFILE_FIELDS);
  const map = new Map<string, FinancialProfile>();
  for (const row of rows) {
    const profile: FinancialProfile = {
      user_id: (row as any).user_id,
      home_currency: (row as any).home_currency,
      current_available_balance: parseFloat((row as any).current_available_balance) || 0,
      minimum_balance_to_keep: parseFloat((row as any).minimum_balance_to_keep) || 0,
      financial_priorities: (row as any).financial_priorities ? (row as any).financial_priorities.split('|') : [],
      expense_categories_to_protect: (row as any).expense_categories_to_protect ? (row as any).expense_categories_to_protect.split('|') : [],
      expense_categories_user_is_willing_to_reduce: (row as any).expense_categories_user_is_willing_to_reduce ? (row as any).expense_categories_user_is_willing_to_reduce.split('|') : [],
      expense_categories_user_is_willing_to_stop: (row as any).expense_categories_user_is_willing_to_stop ? (row as any).expense_categories_user_is_willing_to_stop.split('|') : [],
      payment_methods_user_will_consider: (row as any).payment_methods_user_will_consider ? (row as any).payment_methods_user_will_consider.split('|') : [],
      max_installment_months: (row as any).max_installment_months ? parseInt((row as any).max_installment_months) : null,
    };
    map.set(profile.user_id, profile);
  }
  return map;
}

const EVENT_FIELDS: (keyof FinancialEvent)[] = [
  'event_id', 'user_id', 'event_type', 'description', 'category', 'direction',
  'amount', 'currency', 'event_date', 'settlement_date', 'status', 'linked_event_id',
  'flexibility', 'minimum_allowed_amount'
];

export async function loadFinancialEvents(imagesByEvent: Map<string, ImageRecord>): Promise<FinancialEvent[]> {
  const rows = readCsvAsObjects<FinancialEvent>(resolveDatasetPath('financial_events.csv'), EVENT_FIELDS);
  let events: FinancialEvent[] = rows.map((row: any) => ({
    event_id: row.event_id,
    user_id: row.user_id,
    event_type: row.event_type,
    description: row.description,
    category: row.category,
    direction: row.direction,
    amount: row.amount ? parseFloat(row.amount) : null,
    currency: row.currency,
    event_date: row.event_date,
    settlement_date: row.event_date,
    status: row.status,
    linked_event_id: row.linked_event_id || null,
    flexibility: row.flexibility,
    minimum_allowed_amount: row.minimum_allowed_amount ? parseFloat(row.minimum_allowed_amount) : null,
    is_recurring: false,
  }));

  for (const event of events) {
    if (event.amount === null) {
      const img = imagesByEvent.get(event.event_id);
      if (img) {
        const imgPath = resolveDatasetPath(`media/images/${img.image_id}.png`);
        const extracted = await extractAmountFromImage(imgPath);
        if (extracted !== null && extracted > 0) {
          event.amount = extracted;
        }
      }
    }
  }

  const deduped = dedupeEvents(events);
  return deduped;
}

const RATE_FIELDS: (keyof ExchangeRate)[] = ['rate_date', 'from_currency', 'to_currency', 'rate'];

export function loadExchangeRates(): ExchangeRate[] {
  const rows = readCsvAsObjects<ExchangeRate>(resolveDatasetPath('exchange_rates.csv'), RATE_FIELDS);
  return rows.map((row: any) => ({
    rate_date: row.rate_date,
    from_currency: row.from_currency,
    to_currency: row.to_currency,
    rate: parseFloat(row.rate),
  }));
}

const REQUEST_FIELDS: (keyof Request)[] = ['request_id', 'user_id', 'request_date', 'request_type', 'requested_amount', 'desired_completion_date', 'allows_partial_payment', 'request_text'];

export function loadRequests(): Request[] {
  const rows = readCsvAsObjects<Request>(resolveDatasetPath('requests.csv'), REQUEST_FIELDS);
  return rows.map((row: any) => ({
    request_id: row.request_id,
    user_id: row.user_id,
    request_date: row.request_date,
    request_type: row.request_type,
    requested_amount: parseFloat(row.requested_amount),
    desired_completion_date: row.desired_completion_date,
    allows_partial_payment: row.allows_partial_payment === 'true',
    request_text: row.request_text,
  }));
}

const OPTION_FIELDS: (keyof RequestPaymentOption)[] = ['payment_option_id', 'request_id', 'payment_method', 'payment_amount', 'number_of_payments', 'first_payment_date', 'payment_frequency_days', 'financing_fee', 'total_payable_amount'];

export function loadPaymentOptions(): RequestPaymentOption[] {
  const rows = readCsvAsObjects<RequestPaymentOption>(resolveDatasetPath('request_payment_options.csv'), OPTION_FIELDS);
  return rows.map((row: any) => ({
    payment_option_id: row.payment_option_id,
    request_id: row.request_id,
    payment_method: row.payment_method,
    payment_amount: parseFloat(row.payment_amount),
    number_of_payments: parseInt(row.number_of_payments),
    first_payment_date: row.first_payment_date,
    payment_frequency_days: row.payment_frequency_days ? parseInt(row.payment_frequency_days) : null,
    financing_fee: parseFloat(row.financing_fee),
    total_payable_amount: parseFloat(row.total_payable_amount),
  }));
}

const MESSAGE_FIELDS: (keyof Message)[] = ['message_id', 'user_id', 'request_id', 'related_event_id', 'sent_at', 'source_type', 'message_text'];

export function loadMessages(): Message[] {
  const rows = readCsvAsObjects<Message>(resolveDatasetPath('messages.csv'), MESSAGE_FIELDS);
  return rows.map((row: any) => ({
    message_id: row.message_id,
    user_id: row.user_id,
    request_id: row.request_id || null,
    related_event_id: row.related_event_id || null,
    sent_at: row.sent_at,
    source_type: row.source_type,
    message_text: row.message_text,
  }));
}

const IMAGE_FIELDS: (keyof ImageRecord)[] = ['image_id', 'user_id', 'request_id', 'related_event_id'];

export function loadImages(): ImageRecord[] {
  const rows = readCsvAsObjects<ImageRecord>(resolveDatasetPath('images.csv'), IMAGE_FIELDS);
  return rows.map((row: any) => ({
    image_id: row.image_id,
    user_id: row.user_id,
    request_id: row.request_id,
    related_event_id: row.related_event_id,
  }));
}