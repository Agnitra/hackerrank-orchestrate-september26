import { AllData } from '../join/index';
import { Request } from '../types';

export interface DecisionContext {
  user_id: string;
  request: Request;
  profile: any;
  events: any[];
  paymentOptions: any[];
  messages: any[];
  imagesByEvent: Map<string, any>;
  exchangeRates: any[];
}

export interface DecisionResult {
  amount_safe_to_pay: number;
  affordability_status: string;
  recommended_payment_method: string;
  payment_plan: string;
  earliest_date_for_full_payment: string;
  spending_changes_needed: string;
  decision_explanation: string;
}