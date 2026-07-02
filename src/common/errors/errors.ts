/**
 * Centralized API Error Codes and Messages
 *
 * All error codes follow the pattern: CATEGORY_XXX
 * where XXX is a numeric code within the category.
 *
 * Usage:
 *   throw new UnauthorizedError(ERRORS.AUTH_001, 'AUTH_001');
 */

export const ERRORS = {
  // Auth errors (401/403)
  AUTH_001: 'Invalid or expired token',
  AUTH_002: 'Invalid Google token',
  AUTH_003: 'Your account has been suspended',
  AUTH_004: 'Only ops users can perform backward transitions',

  // Case errors (400/404/422)
  CASE_001: 'Invalid status transition',
  CASE_002: 'Case not found',
  CASE_003: 'Amount exceeds coverage limits',
  CASE_004: 'Planned visit date must be in the future',
  CASE_005: 'Case is not in DRAFT status',
  CASE_006: 'Missing required fields for this transition',
  CASE_007: 'Approved amount is required for PREAPPROVED status',
  CASE_008: 'Card must be issued before marking as CARD_ISSUED',
  CASE_009: 'Claim documents are required before submitting claim',
  CASE_010: 'Settlement record is required before marking as SETTLED',

  // Claim errors (400/404)
  CLAIM_001: 'Claim already exists for this case',
  CLAIM_002: 'Invalid claim status',
  CLAIM_003: 'Claim not found',
  CLAIM_004: 'Bill date cannot be in the future',
  CLAIM_005: 'Invalid bill currency. Only VND is supported',
  CLAIM_006: 'Declaration must be accepted to submit claim',
  CLAIM_007: 'Reviewed amount cannot exceed the original bill amount',

  // Card errors (400/404/422)
  CARD_001: 'Failed to create card',
  CARD_002: 'Card is not active',
  CARD_003: 'Card not found',
  CARD_004: 'activeFrom must be before activeTo',

  // Settlement errors (400/404/422)
  SETTLE_001: 'Invalid settlement action',
  SETTLE_002: 'Failed to create payment link',
  SETTLE_003: 'Failed to create payout',
  SETTLE_004: 'Settlement not found',
  SETTLE_005: 'Unable to calculate settlement - claim may not be submitted',
  SETTLE_006: 'User must have bank account number and bank code set to receive payout',

  // Upload errors (400)
  UPLOAD_001: 'Invalid file type',
  UPLOAD_002: 'File exceeds maximum size',
  UPLOAD_003: 'Maximum files allowed',

  // Config errors (400)
  CONFIG_001: 'Invalid configuration value',

  // Webhook errors (400)
  WEBHOOK_001: 'Invalid webhook signature',

  // User errors (404)
  USER_001: 'User not found',

  // Cardholder errors (404/409/422)
  CARDHOLDER_001: 'Cardholder not found',
  CARDHOLDER_002: 'User already has a cardholder',
  CARDHOLDER_003: 'Failed to create cardholder',
} as const;

export type ErrorCode = keyof typeof ERRORS;
