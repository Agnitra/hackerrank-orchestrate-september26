import { DecisionContext, DecisionResult } from './affordability';

function formatNum(n: number): string {
  if (n === 0) return '0';
  const str = n.toFixed(2);
  return str.replace(/\.?0+$/, '');
}

export function pickPaymentMethod(
  ctx: DecisionContext,
  safeAmount: number,
  earliestFullDate: string | null,
  desiredCompletion: string,
  requestDate: string,
  requestedAmount: number,
  allowsPartial: boolean
): { method: string; plan: string } {
  if (safeAmount <= 0) {
    return { method: 'not_recommended', plan: 'none' };
  }

  if (safeAmount >= requestedAmount && earliestFullDate === requestDate) {
    return { method: 'full_payment', plan: `${requestDate}:${formatNum(requestedAmount)}` };
  }

  if (allowsPartial && safeAmount > 0 && safeAmount < requestedAmount && earliestFullDate) {
    const remaining = requestedAmount - safeAmount;
    return {
      method: 'partial_payment',
      plan: `${requestDate}:${formatNum(safeAmount)}|${earliestFullDate}:${formatNum(remaining)}`,
    };
  }

  if (safeAmount >= requestedAmount && earliestFullDate && earliestFullDate > requestDate) {
    return { method: 'wait', plan: 'none' };
  }

  if (ctx.paymentOptions && ctx.paymentOptions.length > 0) {
    for (const opt of ctx.paymentOptions) {
      if (opt.payment_method === 'installments') {
        const payments = opt.number_of_payments;
        const amount = opt.payment_amount;
        const firstDate = opt.first_payment_date;
        const freq = opt.payment_frequency_days || 30;
        let plan = '';
        for (let i = 0; i < payments; i++) {
          if (i > 0) plan += '|';
          const d = new Date(firstDate);
          d.setDate(d.getDate() + i * freq);
          plan += `${d.toISOString().slice(0, 10)}:${formatNum(amount)}`;
        }
        return { method: 'installments', plan };
      }
    }
  }

  return { method: 'not_recommended', plan: 'none' };
}

export function pickBestPlan(
  ctx: DecisionContext,
  safeAmount: number,
  earliestFullDate: string | null,
  desiredCompletion: string,
  requestDate: string,
  requestedAmount: number,
  allowsPartial: boolean
): DecisionResult {
  if (safeAmount <= 0) {
    return {
      amount_safe_to_pay: 0,
      affordability_status: 'not_affordable',
      recommended_payment_method: 'not_recommended',
      payment_plan: 'none',
      earliest_date_for_full_payment: '',
      spending_changes_needed: 'none',
      decision_explanation: `Do not make this payment by ${desiredCompletion}. None of the available options keeps the ${ctx.profile.minimum_balance_to_keep} minimum protected.`,
    };
  }

  const fullEligible = ctx.profile.payment_methods_user_will_consider.includes('full_payment');
  const partialEligible = ctx.profile.payment_methods_user_will_consider.includes('partial_payment');
  const installmentsEligible = ctx.profile.payment_methods_user_will_consider.includes('installments');

  if (safeAmount >= requestedAmount && fullEligible) {
    return {
      amount_safe_to_pay: requestedAmount,
      affordability_status: 'affordable_now',
      recommended_payment_method: 'full_payment',
      payment_plan: `${requestDate}:${formatNum(requestedAmount)}`,
      earliest_date_for_full_payment: requestDate,
      spending_changes_needed: 'none',
      decision_explanation: `Pay ${formatNum(requestedAmount)} today. This leaves at least ${formatNum(ctx.profile.minimum_balance_to_keep)} available over the next 90 days.`,
    };
  }

  if (safeAmount >= requestedAmount && installmentsEligible && ctx.paymentOptions && ctx.paymentOptions.length > 0) {
    const opt = ctx.paymentOptions.find(o => o.payment_method === 'installments');
    if (opt) {
      let plan = '';
      for (let i = 0; i < opt.number_of_payments; i++) {
        if (i > 0) plan += '|';
        const d = new Date(opt.first_payment_date);
        d.setDate(d.getDate() + i * (opt.payment_frequency_days || 30));
        plan += `${d.toISOString().slice(0, 10)}:${formatNum(opt.payment_amount)}`;
      }
      return {
        amount_safe_to_pay: requestedAmount,
        affordability_status: 'affordable_with_plan',
        recommended_payment_method: 'installments',
        payment_plan: plan,
        earliest_date_for_full_payment: requestDate,
        spending_changes_needed: 'none',
        decision_explanation: `Use ${opt.number_of_payments} installments of ${formatNum(opt.payment_amount)}, starting ${opt.first_payment_date}. This leaves at least ${formatNum(ctx.profile.minimum_balance_to_keep)} available.`,
      };
    }
  }

  if (safeAmount >= requestedAmount && safeAmount < requestedAmount) {
    if (fullEligible) {
      return {
        amount_safe_to_pay: requestedAmount,
        affordability_status: 'affordable_now',
        recommended_payment_method: 'full_payment',
        payment_plan: `${requestDate}:${formatNum(requestedAmount)}`,
        earliest_date_for_full_payment: requestDate,
        spending_changes_needed: 'none',
        decision_explanation: `Pay ${formatNum(requestedAmount)} today. This leaves at least ${formatNum(ctx.profile.minimum_balance_to_keep)} available.`,
      };
    }
  }

  if (allowsPartial && safeAmount > 0 && safeAmount < requestedAmount && earliestFullDate) {
    const remaining = requestedAmount - safeAmount;
    if (partialEligible) {
      return {
        amount_safe_to_pay: safeAmount,
        affordability_status: 'affordable_with_plan',
        recommended_payment_method: 'partial_payment',
        payment_plan: `${requestDate}:${formatNum(safeAmount)}|${earliestFullDate}:${formatNum(remaining)}`,
        earliest_date_for_full_payment: earliestFullDate,
        spending_changes_needed: 'none',
        decision_explanation: `Pay ${formatNum(safeAmount)} today and the remaining ${formatNum(remaining)} on ${earliestFullDate}. This completes the full request and keeps the ${formatNum(ctx.profile.minimum_balance_to_keep)} minimum protected.`,
      };
    }
  }

  if (safeAmount >= requestedAmount && earliestFullDate && earliestFullDate > requestDate) {
    return {
      amount_safe_to_pay: requestedAmount,
      affordability_status: 'affordable_later',
      recommended_payment_method: 'wait',
      payment_plan: '',
      earliest_date_for_full_payment: earliestFullDate,
      spending_changes_needed: 'none',
      decision_explanation: `Pay ${formatNum(requestedAmount)} in full on ${earliestFullDate}. Paying earlier would take the balance below the ${formatNum(ctx.profile.minimum_balance_to_keep)} minimum.`,
    };
  }

  if (safeAmount > 0 && earliestFullDate) {
    return {
      amount_safe_to_pay: safeAmount,
      affordability_status: 'affordable_later',
      recommended_payment_method: 'wait',
      payment_plan: '',
      earliest_date_for_full_payment: earliestFullDate,
      spending_changes_needed: 'none',
      decision_explanation: `Wait until ${earliestFullDate} to pay ${formatNum(requestedAmount)} in full. Paying earlier would compromise the ${formatNum(ctx.profile.minimum_balance_to_keep)} minimum.`,
    };
  }

  if (safeAmount > 0 && !fullEligible && !partialEligible && !installmentsEligible) {
    return {
      amount_safe_to_pay: safeAmount,
      affordability_status: 'not_affordable',
      recommended_payment_method: 'not_recommended',
      payment_plan: 'none',
      earliest_date_for_full_payment: '',
      spending_changes_needed: 'none',
      decision_explanation: `Do not proceed with the ${formatNum(requestedAmount)} request. None of the available payment methods are accepted.`,
    };
  }

  return {
    amount_safe_to_pay: safeAmount,
    affordability_status: 'not_affordable',
    recommended_payment_method: 'not_recommended',
    payment_plan: 'none',
    earliest_date_for_full_payment: '',
    spending_changes_needed: 'none',
    decision_explanation: `Do not make this payment by ${desiredCompletion}. None of the available options keeps the ${formatNum(ctx.profile.minimum_balance_to_keep)} minimum protected.`,
  };
}