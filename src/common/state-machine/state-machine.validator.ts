import { BadRequestError, ERRORS, ErrorCode } from '../errors';
import { UserRole } from 'src/modules/users/users.interface';

export interface StateTransitionConfig<TState extends string> {
  transitions: Record<TState, TState[]>;
  backwardTransitions?: Partial<Record<TState, TState[]>>;
  invalidTransitionErrorCode: ErrorCode;
  unauthorizedBackwardErrorCode: ErrorCode;
}

export class StateMachineValidator<TState extends string> {
  constructor(private readonly config: StateTransitionConfig<TState>) {}

  /**
   * Validates if a state transition is allowed based on the state machine rules
   * @param currentState - The current state
   * @param newState - The desired new state
   * @param userRole - Optional user role for role-based validation
   * @throws BadRequestError if transition is not allowed
   */
  validate(currentState: TState, newState: TState, userRole?: UserRole): void {
    const allowedTransitions = this.config.transitions[currentState] || [];
    const isBackward = this.isBackwardTransition(currentState, newState);

    // Check if transition is allowed (either forward or backward)
    const isForwardAllowed = allowedTransitions.includes(newState);
    const isTransitionValid = isForwardAllowed || isBackward;

    if (!isTransitionValid) {
      const code = this.config.invalidTransitionErrorCode;
      throw new BadRequestError(
        `${ERRORS[code]}: Cannot transition from ${currentState} to ${newState}`,
        code,
      );
    }

    // If it's a backward transition, check role authorization
    if (isBackward) {
      if (userRole !== UserRole.OPS_REVIEWER && userRole !== UserRole.OPS_ADMIN) {
        const code = this.config.unauthorizedBackwardErrorCode;
        throw new BadRequestError(ERRORS[code], code);
      }
    }
  }

  /**
   * Checks if a transition is a backward transition
   * @param from - The current state
   * @param to - The target state
   * @returns true if this is a backward transition
   */
  private isBackwardTransition(from: TState, to: TState): boolean {
    if (!this.config.backwardTransitions) {
      return false;
    }

    const backwardAllowed = this.config.backwardTransitions[from] || [];
    return backwardAllowed.includes(to);
  }

  /**
   * Gets all allowed transitions from a given state
   * @param currentState - The current state
   * @returns Array of allowed next states
   */
  getAllowedTransitions(currentState: TState): TState[] {
    return this.config.transitions[currentState] || [];
  }

  /**
   * Checks if a specific transition is allowed (without throwing)
   * @param currentState - The current state
   * @param newState - The desired new state
   * @param userRole - Optional user role for role-based validation
   * @returns true if transition is allowed
   */
  isTransitionAllowed(currentState: TState, newState: TState, userRole?: UserRole): boolean {
    try {
      this.validate(currentState, newState, userRole);
      return true;
    } catch {
      return false;
    }
  }
}
