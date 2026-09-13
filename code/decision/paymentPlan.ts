import { AllData } from '../join/index';
import { Request } from '../types';
import { buildForecast, getBalanceAt } from '../forecast/forecast';
import { suggestSpendingChanges, formatSpendingChanges as formatSC } from '../decision/spendingChanges';
import { formatNum } from '../currency/convert';

export interface DecisionResult {
  amount_safe_to_pay: number;
  affordability_status: string;
  recommended_payment_method: string;
  payment_plan: string;
  earliest_date_for_full_payment: string;
  spending_changes_needed: string;
  decision_explanation: string;
}

export function processRequest(request: Request, data: AllData): DecisionResult {
  const profile = data.profiles.get(request.user_id);
  if (!profile) {
    return {
      amount_safe_to_pay: 0,
      affordability_status: 'not_affordable',
      recommended_payment_method: 'not_recommended',
      payment_plan: 'none',
      earliest_date_for_full_payment: '',
      spending_changes_needed: 'none',
      decision_explanation: 'User profile not found.',
    };
  }

  const userEvents = data.eventsByUser.get(request.user_id) || [];
  const userOptions = data.optionsByRequest.get(request.request_id) || [];

  const forecast = buildForecast(profile, userEvents, request.request_date);
  const currentBalance = forecast.projections[0]?.balance ?? profile.current_available_balance;

  const minBal = profile.minimum_balance_to_keep;
  const requested = request.requested_amount;

  const amountSafe = Math.max(0, Math.min(requested, currentBalance - minBal));

  let earliestFull: string | null = null;
  if (amountSafe >= requested) {
    earliestFull = request.request_date;
  } else {
    for (const p of forecast.projections) {
      const daysDiff = Math.round(
        (new Date(p.date).getTime() - new Date(request.request_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff < 0) continue;
      if (p.balance >= minBal + requested) {
        earliestFull = p.date;
        break;
      }
    }
  }

  const fullEligible = profile.payment_methods_user_will_consider.includes('full_payment');
  const partialEligible = profile.payment_methods_user_will_consider.includes('partial_payment');
  const installmentsEligible = profile.payment_methods_user_will_consider.includes('installments');

  if (amountSafe <= 0) {
    return {
      amount_safe_to_pay: 0,
      affordability_status: 'not_affordable',
      recommended_payment_method: 'not_recommended',
      payment_plan: 'none',
      earliest_date_for_full_payment: '',
      spending_changes_needed: 'none',
      decision_explanation: `Do not make this payment by ${request.desired_completion_date}. None of the available options keeps the ${minBal} minimum protected.`,
    };
  }

  if (amountSafe >= requested && fullEligible) {
    return {
      amount_safe_to_pay: requested,
      affordability_status: 'affordable_now',
      recommended_payment_method: 'full_payment',
      payment_plan: `${request.request_date}:${formatNum(requested)}`,
      earliest_date_for_full_payment: request.request_date,
      spending_changes_needed: 'none',
      decision_explanation: `Pay ${formatNum(requested)} today. This leaves at least ${formatNum(minBal)} available over the next 90 days.`,
    };
  }

  if (installmentsEligible && userOptions.length > 0) {
    const opt = userOptions.find(o => o.payment_method === 'installments');
    if (opt && opt.number_of_payments > 1) {
      let plan = '';
      for (let i = 0; i < opt.number_of_payments; i++) {
        if (i > 0) plan += '|';
        const d = new Date(opt.first_payment_date);
        d.setDate(d.getDate() + i * (opt.payment_frequency_days || 30));
        plan += `${d.toISOString().slice(0, 10)}:${formatNum(opt.payment_amount)}`;
      }
      return {
        amount_safe_to_pay: amountSafe,
        affordability_status: 'affordable_with_plan',
        recommended_payment_method: 'installments',
        payment_plan: plan,
        earliest_date_for_full_payment: request.request_date,
        spending_changes_needed: 'none',
        decision_explanation: `Use ${opt.number_of_payments} installments of ${formatNum(opt.payment_amount)}, starting ${opt.first_payment_date}.`,
      };
    }
  }

  if (request.allows_partial_payment && amountSafe > 0 && amountSafe < requested && earliestFull && earliestFull > request.request_date) {
    const remaining = requested - amountSafe;
    if (partialEligible) {
      return {
        amount_safe_to_pay: amountSafe,
        affordability_status: 'affordable_with_plan',
        recommended_payment_method: 'partial_payment',
        payment_plan: `${request.request_date}:${formatNum(amountSafe)}|${earliestFull}:${formatNum(remaining)}`,
        earliest_date_for_full_payment: earliestFull,
        spending_changes_needed: 'none',
        decision_explanation: `Pay ${formatNum(amountSafe)} today and the remaining ${formatNum(remaining)} on ${earliestFull}. This completes the full request and keeps the ${formatNum(minBal)} minimum protected.`,
      };
    }
  }

  const needsSavings = requested - amountSafe;
  if (needsSavings > 0) {
    const protectedCats = profile.expense_categories_to_protect || [];
    const reduceCats = profile.expense_categories_user_is_willing_to_reduce || [];
    const stopCats = profile.expense_categories_user_is_willing_to_stop || [];

    const allDebits = userEvents.filter(
      e => e.direction === 'debit' && e.amount !== null && e.status === 'settled'
    );

    const changes = suggestSpendingChanges(
      allDebits,
      protectedCats,
      reduceCats,
      stopCats,
      needsSavings,
      3
    );

    if (changes.length > 0) {
      const fullAfterChanges = amountSafe + changes.reduce((sum, c) => {
        const evt = allDebits.find(d => d.event_id === c.eventId);
        return sum + (evt && evt.amount !== null ? evt.amount : 0) - (c.newAmount ? c.newAmount : 0);
      }, 0);

      if (fullAfterChanges >= requested) {
        const changeStr = formatSC(changes);
        const method = fullEligible ? 'full_payment' : (installmentsEligible ? 'installments' : 'partial_payment');
        const plan = method === 'full_payment'
          ? `${request.request_date}:${formatNum(requested)}`
          : `${request.request_date}:${formatNum(amountSafe)}`;
        return {
          amount_safe_to_pay: amountSafe,
          affordability_status: 'affordable_with_plan',
          recommended_payment_method: method,
          payment_plan: plan,
          earliest_date_for_full_payment: request.request_date,
          spending_changes_needed: changeStr,
          decision_explanation: `After ${changeStr}, pay ${formatNum(requested)} today. This leaves at least ${formatNum(minBal)} available over the next 90 days.`,
        };
      }
    }
  }

  if (amountSafe < requested && earliestFull && earliestFull > request.request_date) {
    const eligibleMethods = profile.payment_methods_user_will_consider.filter(m => m !== 'not_recommended');
    if (eligibleMethods.includes('full_payment')) {
      return {
        amount_safe_to_pay: amountSafe,
        affordability_status: 'affordable_later',
        recommended_payment_method: 'wait',
        payment_plan: `${earliestFull}:${formatNum(requested)}`,
        earliest_date_for_full_payment: earliestFull,
        spending_changes_needed: 'none',
        decision_explanation: `Wait until ${earliestFull} to pay ${formatNum(requested)} in full. Paying earlier would compromise the ${formatNum(minBal)} minimum.`,
      };
    }
  }

  if (amountSafe >= requested) {
    const method = fullEligible ? 'full_payment' : (installmentsEligible ? 'installments' : (partialEligible ? 'partial_payment' : 'not_recommended'));
    return {
      amount_safe_to_pay: requested,
      affordability_status: 'affordable_now',
      recommended_payment_method: method,
      payment_plan: `${request.request_date}:${formatNum(requested)}`,
      earliest_date_for_full_payment: request.request_date,
      spending_changes_needed: 'none',
      decision_explanation: `Pay ${formatNum(requested)} today. This leaves at least ${formatNum(minBal)} available over the next 90 days.`,
    };
  }

  return {
    amount_safe_to_pay: amountSafe,
    affordability_status: 'not_affordable',
    recommended_payment_method: 'not_recommended',
    payment_plan: 'none',
    earliest_date_for_full_payment: '',
    spending_changes_needed: 'none',
    decision_explanation: `Do not make this payment by ${request.desired_completion_date}. None of the available options keeps the ${minBal} minimum protected.`,
  };
}