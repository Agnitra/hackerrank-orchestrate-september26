import { FinancialProfile, FinancialEvent, Request, RequestPaymentOption, Message, ImageRecord, ExchangeRate } from '../types';
import {
  loadFinancialProfiles,
  loadFinancialEvents,
  loadExchangeRates,
  loadRequests,
  loadPaymentOptions,
  loadMessages,
  loadImages,
} from './loadAllData';
import { dedupeEvents } from '../state/dedupe';

export interface AllData {
  profiles: Map<string, FinancialProfile>;
  events: FinancialEvent[];
  exchangeRates: ExchangeRate[];
  requests: Request[];
  paymentOptions: RequestPaymentOption[];
  messages: Message[];
  images: ImageRecord[];
  eventMap: Map<string, FinancialEvent>;
  eventsByUser: Map<string, FinancialEvent[]>;
  optionsByRequest: Map<string, RequestPaymentOption[]>;
  imagesByEvent: Map<string, ImageRecord>;
}

export function buildEventMap(events: FinancialEvent[]): Map<string, FinancialEvent> {
  const map = new Map<string, FinancialEvent>();
  for (const event of events) {
    map.set(event.event_id, event);
  }
  return map;
}

export function buildEventsByUser(events: FinancialEvent[]): Map<string, FinancialEvent[]> {
  const map = new Map<string, FinancialEvent[]>();
  for (const event of events) {
    if (!map.has(event.user_id)) map.set(event.user_id, []);
    map.get(event.user_id)!.push(event);
  }
  return map;
}

export function buildOptionsByRequest(options: RequestPaymentOption[]): Map<string, RequestPaymentOption[]> {
  const map = new Map<string, RequestPaymentOption[]>();
  for (const opt of options) {
    if (!map.has(opt.request_id)) map.set(opt.request_id, []);
    map.get(opt.request_id)!.push(opt);
  }
  return map;
}

export function buildImagesByEvent(images: ImageRecord[]): Map<string, ImageRecord> {
  const map = new Map<string, ImageRecord>();
  for (const img of images) {
    map.set(img.related_event_id, img);
  }
  return map;
}

export async function loadAllData(): Promise<AllData> {
  const profiles = loadFinancialProfiles();
  const images = loadImages();
  const imagesByEvent = buildImagesByEvent(images);
  const events = await loadFinancialEvents(imagesByEvent);
  const dedupedEvents = dedupeEvents(events);
  const exchangeRates = loadExchangeRates();
  const requests = loadRequests();
  const paymentOptions = loadPaymentOptions();
  const messages = loadMessages();

  return {
    profiles,
    events: dedupedEvents,
    exchangeRates,
    requests,
    paymentOptions,
    messages,
    images,
    eventMap: buildEventMap(dedupedEvents),
    eventsByUser: buildEventsByUser(dedupedEvents),
    optionsByRequest: buildOptionsByRequest(paymentOptions),
    imagesByEvent,
  };
}