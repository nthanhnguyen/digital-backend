import { StateMachineValidator } from './state-machine.validator';
import { BadRequestError } from '../errors';
import { UserRole } from 'src/modules/users/users.interface';

enum TestStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CLOSED = 'CLOSED',
}

describe('StateMachineValidator', () => {
  const transitions: Record<TestStatus, TestStatus[]> = {
    [TestStatus.DRAFT]: [TestStatus.SUBMITTED],
    [TestStatus.SUBMITTED]: [TestStatus.APPROVED, TestStatus.REJECTED],
    [TestStatus.APPROVED]: [TestStatus.CLOSED],
    [TestStatus.REJECTED]: [TestStatus.CLOSED],
    [TestStatus.CLOSED]: [],
  };

  const backwardTransitions: Partial<Record<TestStatus, TestStatus[]>> = {
    [TestStatus.APPROVED]: [TestStatus.SUBMITTED],
    [TestStatus.REJECTED]: [TestStatus.SUBMITTED],
  };

  let validator: StateMachineValidator<TestStatus>;

  beforeEach(() => {
    validator = new StateMachineValidator<TestStatus>({
      transitions,
      backwardTransitions,
      invalidTransitionErrorCode: 'CASE_001',
      unauthorizedBackwardErrorCode: 'AUTH_004',
    });
  });

  describe('validate - forward transitions', () => {
    it('should allow valid forward transition', () => {
      expect(() => {
        validator.validate(TestStatus.DRAFT, TestStatus.SUBMITTED);
      }).not.toThrow();
    });

    it('should allow multiple valid transitions from one state', () => {
      expect(() => {
        validator.validate(TestStatus.SUBMITTED, TestStatus.APPROVED);
      }).not.toThrow();

      expect(() => {
        validator.validate(TestStatus.SUBMITTED, TestStatus.REJECTED);
      }).not.toThrow();
    });

    it('should throw BadRequestError for invalid forward transition', () => {
      expect(() => {
        validator.validate(TestStatus.DRAFT, TestStatus.APPROVED);
      }).toThrow(BadRequestError);

      expect(() => {
        validator.validate(TestStatus.DRAFT, TestStatus.APPROVED);
      }).toThrow(/Invalid status transition/);
    });

    it('should throw BadRequestError when transitioning from terminal state', () => {
      expect(() => {
        validator.validate(TestStatus.CLOSED, TestStatus.DRAFT);
      }).toThrow(BadRequestError);
    });

    it('should throw BadRequestError for self-transition not in allowed list', () => {
      expect(() => {
        validator.validate(TestStatus.DRAFT, TestStatus.DRAFT);
      }).toThrow(BadRequestError);
    });
  });

  describe('validate - backward transitions', () => {
    it('should allow backward transition for OPS role', () => {
      expect(() => {
        validator.validate(TestStatus.APPROVED, TestStatus.SUBMITTED, UserRole.OPS_REVIEWER);
      }).not.toThrow();
    });

    it('should allow backward transition for ADMIN role', () => {
      expect(() => {
        validator.validate(TestStatus.APPROVED, TestStatus.SUBMITTED, UserRole.OPS_ADMIN);
      }).not.toThrow();
    });

    it('should throw BadRequestError for backward transition without role', () => {
      expect(() => {
        validator.validate(TestStatus.APPROVED, TestStatus.SUBMITTED);
      }).toThrow(BadRequestError);

      expect(() => {
        validator.validate(TestStatus.APPROVED, TestStatus.SUBMITTED);
      }).toThrow(/Only ops users can perform backward transitions/);
    });

    it('should throw BadRequestError for backward transition with USER role', () => {
      expect(() => {
        validator.validate(TestStatus.APPROVED, TestStatus.SUBMITTED, UserRole.USER);
      }).toThrow(BadRequestError);

      expect(() => {
        validator.validate(TestStatus.APPROVED, TestStatus.SUBMITTED, UserRole.USER);
      }).toThrow(/Only ops users can perform backward transitions/);
    });

    it('should allow multiple backward transitions', () => {
      expect(() => {
        validator.validate(TestStatus.APPROVED, TestStatus.SUBMITTED, UserRole.OPS_REVIEWER);
      }).not.toThrow();

      expect(() => {
        validator.validate(TestStatus.REJECTED, TestStatus.SUBMITTED, UserRole.OPS_REVIEWER);
      }).not.toThrow();
    });
  });

  describe('isTransitionAllowed', () => {
    it('should return true for valid forward transition', () => {
      const result = validator.isTransitionAllowed(TestStatus.DRAFT, TestStatus.SUBMITTED);
      expect(result).toBe(true);
    });

    it('should return false for invalid forward transition', () => {
      const result = validator.isTransitionAllowed(TestStatus.DRAFT, TestStatus.APPROVED);
      expect(result).toBe(false);
    });

    it('should return true for backward transition with OPS role', () => {
      const result = validator.isTransitionAllowed(
        TestStatus.APPROVED,
        TestStatus.SUBMITTED,
        UserRole.OPS_REVIEWER,
      );
      expect(result).toBe(true);
    });

    it('should return false for backward transition without role', () => {
      const result = validator.isTransitionAllowed(TestStatus.APPROVED, TestStatus.SUBMITTED);
      expect(result).toBe(false);
    });

    it('should return false for backward transition with USER role', () => {
      const result = validator.isTransitionAllowed(
        TestStatus.APPROVED,
        TestStatus.SUBMITTED,
        UserRole.USER,
      );
      expect(result).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return all allowed transitions from a state', () => {
      const allowed = validator.getAllowedTransitions(TestStatus.SUBMITTED);
      expect(allowed).toEqual([TestStatus.APPROVED, TestStatus.REJECTED]);
    });

    it('should return single transition for single-option state', () => {
      const allowed = validator.getAllowedTransitions(TestStatus.DRAFT);
      expect(allowed).toEqual([TestStatus.SUBMITTED]);
    });

    it('should return empty array for terminal state', () => {
      const allowed = validator.getAllowedTransitions(TestStatus.CLOSED);
      expect(allowed).toEqual([]);
    });

    it('should return empty array for unknown state', () => {
      const allowed = validator.getAllowedTransitions('UNKNOWN' as TestStatus);
      expect(allowed).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle validator without backward transitions', () => {
      const simpleValidator = new StateMachineValidator<TestStatus>({
        transitions,
        invalidTransitionErrorCode: 'CASE_001',
        unauthorizedBackwardErrorCode: 'AUTH_004',
      });

      expect(() => {
        simpleValidator.validate(TestStatus.DRAFT, TestStatus.SUBMITTED);
      }).not.toThrow();

      expect(() => {
        simpleValidator.validate(TestStatus.APPROVED, TestStatus.SUBMITTED, UserRole.OPS_REVIEWER);
      }).toThrow(BadRequestError);
    });

    it('should work with minimal configuration', () => {
      const minimalTransitions: Record<TestStatus, TestStatus[]> = {
        [TestStatus.DRAFT]: [TestStatus.SUBMITTED],
        [TestStatus.SUBMITTED]: [],
        [TestStatus.APPROVED]: [],
        [TestStatus.REJECTED]: [],
        [TestStatus.CLOSED]: [],
      };

      const minimalValidator = new StateMachineValidator<TestStatus>({
        transitions: minimalTransitions,
        invalidTransitionErrorCode: 'CASE_001',
        unauthorizedBackwardErrorCode: 'AUTH_004',
      });

      expect(() => {
        minimalValidator.validate(TestStatus.DRAFT, TestStatus.SUBMITTED);
      }).not.toThrow();
    });
  });
});
