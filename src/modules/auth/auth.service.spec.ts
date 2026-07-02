import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LoggerService } from '../../common/infrastructure/logger';
import { UnauthorizedError, ForbiddenError, ERRORS } from '../../common/errors';
import { UserRole, UserStatus } from '../users/users.interface';
import { LoginType } from './auth.interface';

// Mock google-auth-library
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let logger: LoggerService;
  let mockVerifyIdToken: jest.Mock;

  beforeEach(async () => {
    mockVerifyIdToken = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByGoogleSub: jest.fn(),
            findByEmail: jest.fn(),
            linkGoogleAccount: jest.fn(),
            createFromGoogle: jest.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    logger = module.get<LoggerService>(LoggerService);

    // Mock the OAuth2Client verifyIdToken method
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).googleClient.verifyIdToken = mockVerifyIdToken;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateGoogleToken', () => {
    const mockIdToken = 'mock-google-id-token';
    const mockGoogleSub = 'google-sub-123';
    const mockEmail = 'test@example.com';
    const mockName = 'Test User';

    const mockUser = {
      id: 'user-123',
      googleSub: mockGoogleSub,
      email: mockEmail,
      name: mockName,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    it('should authenticate existing user with google_sub', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: mockGoogleSub,
          email: mockEmail,
          name: mockName,
        }),
      });

      jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(mockUser);

      const result = await service.validateGoogleToken(mockIdToken, LoginType.PORTAL);

      expect(result).toEqual(mockUser);
      expect(usersService.findByGoogleSub).toHaveBeenCalledWith(mockGoogleSub);
      expect(usersService.findByEmail).not.toHaveBeenCalled();
      expect(usersService.createFromGoogle).not.toHaveBeenCalled();
    });

    it('should link google account to existing user by email', async () => {
      const userWithoutGoogleSub = { ...mockUser, googleSub: undefined };
      const userWithGoogleSub = { ...mockUser, googleSub: mockGoogleSub };

      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: mockGoogleSub,
          email: mockEmail,
          name: mockName,
        }),
      });

      jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(null);
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(userWithoutGoogleSub);
      jest.spyOn(usersService, 'linkGoogleAccount').mockResolvedValue(userWithGoogleSub);

      const result = await service.validateGoogleToken(mockIdToken, LoginType.PORTAL);

      expect(result).toEqual(userWithGoogleSub);
      expect(usersService.findByGoogleSub).toHaveBeenCalledWith(mockGoogleSub);
      expect(usersService.findByEmail).toHaveBeenCalledWith(mockEmail);
      expect(usersService.linkGoogleAccount).toHaveBeenCalledWith(
        userWithoutGoogleSub.id,
        mockGoogleSub,
      );
      expect(usersService.createFromGoogle).not.toHaveBeenCalled();
    });

    it('should create new user if not found by google_sub or email', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: mockGoogleSub,
          email: mockEmail,
          name: mockName,
        }),
      });

      jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(null);
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(usersService, 'createFromGoogle').mockResolvedValue(mockUser);

      const result = await service.validateGoogleToken(mockIdToken, LoginType.PORTAL);

      expect(result).toEqual(mockUser);
      expect(usersService.findByGoogleSub).toHaveBeenCalledWith(mockGoogleSub);
      expect(usersService.findByEmail).toHaveBeenCalledWith(mockEmail);
      expect(usersService.createFromGoogle).toHaveBeenCalledWith({
        googleSub: mockGoogleSub,
        email: mockEmail,
        name: mockName,
      });
    });

    it('should throw UnauthorizedError if token payload is invalid', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => null,
      });

      await expect(service.validateGoogleToken(mockIdToken, LoginType.PORTAL)).rejects.toThrow(
        UnauthorizedError,
      );
      await expect(service.validateGoogleToken(mockIdToken, LoginType.PORTAL)).rejects.toThrow(
        ERRORS.AUTH_002,
      );
    });

    it('should throw UnauthorizedError if payload is missing required fields', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: mockGoogleSub,
          // Missing email and name
        }),
      });

      await expect(service.validateGoogleToken(mockIdToken, LoginType.PORTAL)).rejects.toThrow(
        UnauthorizedError,
      );
      await expect(service.validateGoogleToken(mockIdToken, LoginType.PORTAL)).rejects.toThrow(
        ERRORS.AUTH_002,
      );
    });

    it('should throw UnauthorizedError if verifyIdToken fails', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

      await expect(service.validateGoogleToken(mockIdToken, LoginType.PORTAL)).rejects.toThrow(
        UnauthorizedError,
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Google token validation failed',
        expect.any(Error),
      );
    });

    it('should throw UnauthorizedError if user service fails', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: mockGoogleSub,
          email: mockEmail,
          name: mockName,
        }),
      });

      jest.spyOn(usersService, 'findByGoogleSub').mockRejectedValue(new Error('Database error'));

      await expect(service.validateGoogleToken(mockIdToken, LoginType.PORTAL)).rejects.toThrow(
        UnauthorizedError,
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Google token validation failed',
        expect.any(Error),
      );
    });

    it('should throw ForbiddenError if existing user is SUSPENDED', async () => {
      const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED };

      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: mockGoogleSub,
          email: mockEmail,
          name: mockName,
        }),
      });

      jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(suspendedUser);

      await expect(service.validateGoogleToken(mockIdToken, LoginType.PORTAL)).rejects.toThrow(
        ForbiddenError,
      );
      await expect(service.validateGoogleToken(mockIdToken, LoginType.PORTAL)).rejects.toThrow(
        ERRORS.AUTH_003,
      );
      expect(logger.warn).toHaveBeenCalledWith('Login attempt blocked - account suspended', {
        email: mockEmail,
        userId: suspendedUser.id,
      });
    });

    it('should throw ForbiddenError if user found by email and linked is SUSPENDED', async () => {
      const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED };

      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: mockGoogleSub,
          email: mockEmail,
          name: mockName,
        }),
      });

      jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(null);
      jest
        .spyOn(usersService, 'findByEmail')
        .mockResolvedValue({ ...suspendedUser, googleSub: undefined });
      jest.spyOn(usersService, 'linkGoogleAccount').mockResolvedValue(suspendedUser);

      await expect(service.validateGoogleToken(mockIdToken, LoginType.PORTAL)).rejects.toThrow(
        ForbiddenError,
      );
      await expect(service.validateGoogleToken(mockIdToken, LoginType.PORTAL)).rejects.toThrow(
        ERRORS.AUTH_003,
      );
    });

    it('should allow login for ACTIVE user status', async () => {
      const activeUser = { ...mockUser, status: UserStatus.ACTIVE };

      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: mockGoogleSub,
          email: mockEmail,
          name: mockName,
        }),
      });

      jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(activeUser);

      const result = await service.validateGoogleToken(mockIdToken, LoginType.PORTAL);

      expect(result).toEqual(activeUser);
      expect(logger.info).toHaveBeenCalledWith('User authenticated successfully via Google', {
        userId: activeUser.id,
        email: activeUser.email,
      });
    });
  });
});
