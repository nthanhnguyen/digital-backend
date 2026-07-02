/**
 * Settlement calculation result
 */
export interface SettlementCalculationResult {
  reviewedBillAmount: number;
  insurerLiability: number;
  deductible: number;
  copayAmount: number;
  userCostShare: number;
  platformExpectedPay: number;
  cardPaidAmount: number;
  difference: number;
}

/**
 * Cost share rule input for calculation
 */
export interface CostShareRuleInput {
  deductibleAmount: number;
  copayPercentage: number;
  copayCap: number | null;
}

/**
 * Claim input for calculation
 */
export interface ClaimInput {
  billAmount: number;
  reviewedBillAmount?: number | null;
  submittedAt: Date | null;
}

/**
 * Transaction input for calculation
 */
export interface TransactionInput {
  amount: number;
  status: string;
}

// Default settlement constants (used when no active rule in DB)
const DEFAULT_DEDUCTIBLE_AMOUNT = 200;
const DEFAULT_COPAY_PERCENTAGE = 0.1;
const DEFAULT_COPAY_CAP: number | null = 1000;

/**
 * Calculate settlement preview based on business rules:
 * - reviewed_bill_amount = amount validated by Ops (can be <= uploaded bill)
 * - insurer_liability = min(approved_amount, reviewed_bill_amount)
 * - user_cost_share = deductible + copay_pct * max(0, insurer_liability - deductible) (capped if configured)
 * - platform_expected_pay = insurer_liability - user_cost_share
 */
export function calculateSettlementPreview(
  claim: ClaimInput,
  approvedAmount: number,
  transactions: TransactionInput[],
  costShareRule: CostShareRuleInput | null,
): SettlementCalculationResult | null {
  // Only calculate if claim has been submitted
  if (!claim.submittedAt) {
    return null;
  }

  // Use cost share rules from DB, or fall back to defaults
  const deductibleAmount = costShareRule?.deductibleAmount ?? DEFAULT_DEDUCTIBLE_AMOUNT;
  const copayPercentage = costShareRule
    ? costShareRule.copayPercentage / 100
    : DEFAULT_COPAY_PERCENTAGE;
  const copayCap = costShareRule?.copayCap ?? DEFAULT_COPAY_CAP;

  // Use reviewed amount if available, otherwise use bill amount
  const reviewedBillAmount = claim.reviewedBillAmount ?? claim.billAmount;

  // Insurer liability = min(approved_amount, reviewed_bill_amount)
  const insurerLiability = Math.min(approvedAmount, reviewedBillAmount);

  // Deductible is a fixed amount per case
  const deductible = deductibleAmount;

  // Copay base = max(0, insurer_liability - deductible)
  const copayBase = Math.max(0, insurerLiability - deductible);

  // Copay amount = copay_pct * copay_base (capped if configured)
  let copayAmount = Math.round(copayBase * copayPercentage * 100) / 100;

  // Apply co-pay cap if configured
  if (copayCap !== null && copayAmount > copayCap) {
    copayAmount = copayCap;
  }

  // User cost share = deductible + copay_amount
  const userCostShare = deductible + copayAmount;

  // Platform expected pay = insurer_liability - user_cost_share
  const platformExpectedPay = Math.max(0, insurerLiability - userCostShare);

  // Card paid amount = sum of successful transactions
  const cardPaidAmount = transactions
    .filter((t) => t.status === 'SUCCEEDED')
    .reduce((sum, t) => sum + t.amount, 0);

  // Difference = |card_paid_amount - platform_expected_pay|
  const difference = Math.abs(cardPaidAmount - platformExpectedPay);

  return {
    reviewedBillAmount,
    insurerLiability,
    deductible,
    copayAmount,
    userCostShare,
    platformExpectedPay,
    cardPaidAmount,
    difference,
  };
}
