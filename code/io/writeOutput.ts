import * as fs from 'fs';
import * as path from 'path';
import { BASE_DIR } from './loadCsv';
import { OutputRow } from '../types';

export function writeOutput(rows: OutputRow[]): void {
  const outputPath = path.join(BASE_DIR, 'output.csv');
  const header = 'request_id,amount_safe_to_pay,affordability_status,recommended_payment_method,payment_plan,earliest_date_for_full_payment,spending_changes_needed,decision_explanation';
  const lines = [header, ...rows.map(rowToCsv)];
  fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf-8');
}

function rowToCsv(row: OutputRow): string {
  const fields = [
    row.request_id,
    formatAmount(row.amount_safe_to_pay),
    row.affordability_status,
    row.recommended_payment_method,
    row.payment_plan,
    row.earliest_date_for_full_payment,
    row.spending_changes_needed,
    escapeCsv(row.decision_explanation),
  ];
  return fields.join(',');
}

function formatAmount(n: number): string {
  if (n === 0) return '0';
  const str = n.toFixed(2);
  return str.replace(/\.?0+$/, '');
}

function escapeCsv(s: string): string {
  if (!s) return '';
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}