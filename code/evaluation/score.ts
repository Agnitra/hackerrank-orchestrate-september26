import { readCsvAsObjects, resolveDatasetPath } from '../io/loadCsv';
import { OutputRow } from '../types';

const FIELDS = ['request_id', 'amount_safe_to_pay', 'affordability_status', 'recommended_payment_method', 'payment_plan', 'earliest_date_for_full_payment', 'spending_changes_needed', 'decision_explanation'] as const;

export function scoreAgainstSample(outputRows: OutputRow[]): { passed: number; total: number; accuracy: number } {
  const sampleFile = resolveDatasetPath('sample_requests.csv');
  const sampleRows: any[] = [];
  const rows = readCsvAsObjects<any>(sampleFile, FIELDS as any);
  for (const row of rows) {
    sampleRows.push(row);
  }

  let passed = 0;
  const total = sampleRows.length;

  for (const sample of sampleRows) {
    const output = outputRows.find(r => r.request_id === sample.request_id);
    if (!output) continue;

    let match = true;
    if (sample.amount_safe_to_pay && output.amount_safe_to_pay !== parseFloat(sample.amount_safe_to_pay)) match = false;
    if (sample.affordability_status && output.affordability_status !== sample.affordability_status) match = false;
    if (sample.recommended_payment_method && output.recommended_payment_method !== sample.recommended_payment_method) match = false;
    if (sample.payment_plan && output.payment_plan !== sample.payment_plan) match = false;
    if (sample.earliest_date_for_full_payment && output.earliest_date_for_full_payment !== sample.earliest_date_for_full_payment) match = false;
    if (sample.spending_changes_needed && output.spending_changes_needed !== sample.spending_changes_needed) match = false;

    if (match) passed++;
  }

  return { passed, total, accuracy: total > 0 ? passed / total : 0 };
}