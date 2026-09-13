import * as fs from 'fs';
import * as path from 'path';

function formatNum(n: number): string {
  if (n === 0) return '0';
  const str = n.toFixed(2);
  return str.replace(/\.?0+$/, '');
}

export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string, date: string, rates: any[]): number {
  if (fromCurrency === toCurrency) return amount;
  const rate = findRate(fromCurrency, toCurrency, date, rates);
  if (rate === null) return amount;
  return amount * rate;
}

function findRate(from: string, to: string, date: string, rates: any[]): number | null {
  const exact = rates.find((r: any) => r.from_currency === from && r.to_currency === to && r.rate_date === date);
  if (exact) return exact.rate;
  const fallback = rates.find((r: any) => r.from_currency === from && r.to_currency === to && r.rate_date <= date);
  if (fallback) return fallback.rate;
  return null;
}

export async function extractAmountFromImage(imagePath: string): Promise<number | null> {
  try {
    if (!fs.existsSync(imagePath)) return null;
    const Tesseract = require('tesseract.js');
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
    const matches = text.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g);
    if (!matches || matches.length === 0) return null;
    const cleaned: number[] = matches.map((m: string) => parseFloat(m.replace(/,/g, '')));
    const positive = cleaned.filter((n: number) => n > 0);
    if (positive.length === 0) return null;
    positive.sort((a: number, b: number) => b - a);
    return positive[0] as number;
  } catch {
    return null;
  }
}

export async function extractAmountsBatch(imagePaths: string[]): Promise<Map<string, number | null>> {
  const results = new Map<string, number | null>();
  for (const p of imagePaths) {
    results.set(p, await extractAmountFromImage(p));
  }
  return results;
}

export { formatNum };