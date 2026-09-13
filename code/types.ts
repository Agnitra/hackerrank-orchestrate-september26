export interface FinancialProfile {
  user_id: string;
  home_currency: string;
  current_available_balance: number;
  minimum_balance_to_keep: number;
  financial_priorities: string[];
  expense_categories_to_protect: string[];
  expense_categories_user_is_willing_to_reduce: string[];
  expense_categories_user_is_willing_to_stop: string[];
  payment_methods_user_will_consider: string[];
  max_installment_months: number | null;
}

export interface FinancialEvent {
  event_id: string;
  user_id: string;
  event_type: string;
  description: string;
  category: string;
  direction: 'debit' | 'credit';
  amount: number | null;
  currency: string;
  event_date: string;
  settlement_date: string;
  status: string;
  linked_event_id: string | null;
  flexibility: string;
  minimum_allowed_amount: number | null;
  is_recurring: boolean;
}

export interface ExchangeRate {
  rate_date: string;
  from_currency: string;
  to_currency: string;
  rate: number;
}

export interface Request {
  request_id: string;
  user_id: string;
  request_date: string;
  request_type: string;
  requested_amount: number;
  desired_completion_date: string;
  allows_partial_payment: boolean;
  request_text: string;
}

export interface RequestPaymentOption {
  payment_option_id: string;
  request_id: string;
  payment_method: string;
  payment_amount: number;
  number_of_payments: number;
  first_payment_date: string;
  payment_frequency_days: number | null;
  financing_fee: number;
  total_payable_amount: number;
}

export interface Message {
  message_id: string;
  user_id: string;
  request_id: string | null;
  related_event_id: string | null;
  sent_at: string;
  source_type: string;
  message_text: string;
}

export interface ImageRecord {
  image_id: string;
  user_id: string;
  request_id: string;
  related_event_id: string;
}

export interface OutputRow {
  request_id: string;
  amount_safe_to_pay: number;
  affordability_status: string;
  recommended_payment_method: string;
  payment_plan: string;
  earliest_date_for_full_payment: string;
  spending_changes_needed: string;
  decision_explanation: string;
}

export interface ProjectedBalance {
  date: string;
  balance: number;
}

export interface RecurringPattern {
  category: string;
  avgAmount: number;
  periodDays: number;
  isRecurring: boolean;
  eventIds: string[];
  totalEvents: number;
}