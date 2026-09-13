import { writeOutput } from './io/writeOutput';
import { processRequest } from './decision/paymentPlan';
import { loadAllData } from './join/index';
import { OutputRow } from './types';

function decisionToOutput(r: any): OutputRow {
  return {
    request_id: r.request_id || '',
    amount_safe_to_pay: r.amount_safe_to_pay ?? 0,
    affordability_status: r.affordability_status || 'not_affordable',
    recommended_payment_method: r.recommended_payment_method || 'not_recommended',
    payment_plan: r.payment_plan || 'none',
    earliest_date_for_full_payment: r.earliest_date_for_full_payment || '',
    spending_changes_needed: r.spending_changes_needed || 'none',
    decision_explanation: r.decision_explanation || '',
  };
}

async function main() {
  const args = process.argv.slice(2);

  console.log('Loading data...');
  const data = await loadAllData();
  console.log(`Loaded ${data.requests.length} requests, ${data.events.length} events, ${data.profiles.size} profiles.`);

  const results: OutputRow[] = [];
  for (const request of data.requests) {
    const result = processRequest(request, data);
    results.push({
      ...decisionToOutput(result),
      request_id: request.request_id,
    });
  }

  writeOutput(results);
  console.log(`Wrote ${results.length} results to output.csv`);
}

main().catch(console.error);