import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/apps/service/app.module';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '../src/modules/users/users.interface';
import { UsersService } from '../src/modules/users/users.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { LoginType } from '../src/modules/auth/auth.interface';
import { PgClientService } from '../src/common/infrastructure/pg-client';
import { LoggerService } from '../src/common/infrastructure/logger/logger.service';
import { AirwallexAuthService } from '../src/modules/airwallex/airwallex-auth.service';

describe('Auth API (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let jwtService: JwtService;
  let usersService: UsersService;
  let authService: AuthService;

  const testUserId = 'test-user-id-123';
  const mockUser = {
    id: testUserId,
    googleSub: 'google-test-sub-123',
    email: 'test@example.com',
    name: 'Test User',
    phone: undefined,
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    bankAccountNumber: undefined,
    bankCode: undefined,
    bankName: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PgClientService)
      .useValue({
        master: {
          query: jest.fn(),
        },
        replica: {
          query: jest.fn(),
        },
        masterPool: {
          query: jest.fn(),
        },
        replicaPool: {
          query: jest.fn(),
        },
        onModuleInit: jest.fn().mockResolvedValue(undefined),
        onApplicationShutdown: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(UsersService)
      .useValue({
        findById: jest.fn(),
        findByEmail: jest.fn(),
        findByGoogleSub: jest.fn(),
        createFromGoogle: jest.fn(),
        linkGoogleAccount: jest.fn(),
        updateProfile: jest.fn(),
      })
      .overrideProvider(AuthService)
      .useValue({
        validateGoogleToken: jest.fn(),
      })
      .overrideProvider(AirwallexAuthService)
      .useValue({
        onModuleInit: jest.fn().mockResolvedValue(undefined),
        getAccessToken: jest.fn().mockResolvedValue('e2e-stub-token'),
      })
      .overrideProvider(LoggerService)
      .useValue({
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
        info: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Get services for testing
    jwtService = app.get<JwtService>(JwtService);
    usersService = app.get<UsersService>(UsersService);
    authService = app.get<AuthService>(AuthService);

    // Generate a valid JWT token for the test user
    accessToken = jwtService.sign({
      sub: testUserId,
      email: 'test@example.com',
      role: UserRole.USER,
    });

    // Setup default mocks
    jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /mobile/auth/google', () => {
    it('should authenticate user with valid Google token', async () => {
      jest.spyOn(authService, 'validateGoogleToken').mockResolvedValue(mockUser);

      const response = await request(app.getHttpServer())
        .post('/mobile/auth/google')
        .send({
          idToken: 'valid-google-token',
          platform: 'ios',
        })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('expiresIn', 604800);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('id', testUserId);
      expect(response.body.data.user).toHaveProperty('email', 'test@example.com');
      expect(authService.validateGoogleToken).toHaveBeenCalledWith(
        'valid-google-token',
        LoginType.MOBILE_IOS,
      );
    });

    it('should reject invalid Google token', async () => {
      jest
        .spyOn(authService, 'validateGoogleToken')
        .mockRejectedValue(new UnauthorizedException('Invalid token'));

      await request(app.getHttpServer())
        .post('/mobile/auth/google')
        .send({
          idToken: 'invalid-token',
          platform: 'ios',
        })
        .expect(401);
    });

    it('should validate request body schema', async () => {
      await request(app.getHttpServer())
        .post('/mobile/auth/google')
        .send({
          // Missing idToken
        })
        .expect(400);
    });

    it('should reject empty idToken', async () => {
      await request(app.getHttpServer())
        .post('/mobile/auth/google')
        .send({
          idToken: '',
        })
        .expect(400);
    });
  });

  describe('GET /mobile/auth/me', () => {
    it('should return current user profile with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/mobile/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id', testUserId);
      expect(response.body.data).toHaveProperty('email', 'test@example.com');
      expect(response.body.data).toHaveProperty('name', 'Test User');
      expect(response.body.data).toHaveProperty('role', UserRole.USER);
      expect(response.body.data).toHaveProperty('createdAt');
    });

    it('should reject unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/mobile/auth/me').expect(401);
    });

    it('should reject invalid token', async () => {
      await request(app.getHttpServer())
        .get('/mobile/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject malformed authorization header', async () => {
      await request(app.getHttpServer())
        .get('/mobile/auth/me')
        .set('Authorization', 'InvalidFormat')
        .expect(401);
    });
  });

  describe('Authorization and Authentication Flow', () => {
    it('should include all required user fields in response', async () => {
      const response = await request(app.getHttpServer())
        .get('/mobile/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const { data } = response.body;
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('email');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('role');
      expect(data).toHaveProperty('createdAt');
      // Note: Optional fields (phone, bankAccountNumber, bankCode, bankName)
      // are not returned in the response when they are undefined
    });

    it('should not expose sensitive user data', async () => {
      const response = await request(app.getHttpServer())
        .get('/mobile/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const { data } = response.body;
      // Should not expose sensitive fields like password_hash, google_sub, etc.
      expect(data).not.toHaveProperty('password_hash');
      expect(data).not.toHaveProperty('googleSub');
      expect(data).not.toHaveProperty('deleted_at');
      expect(data).not.toHaveProperty('updated_at');
    });
  });

  describe('JWT Token Validation', () => {
    it('should reject expired token', async () => {
      // Create an expired token (expired 1 hour ago)
      const expiredToken = jwtService.sign(
        {
          sub: testUserId,
          email: 'test@example.com',
          role: UserRole.USER,
        },
        { expiresIn: '-1h' },
      );

      await request(app.getHttpServer())
        .get('/mobile/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should reject token for non-existent user', async () => {
      // Mock findById to return null for non-existent user
      jest.spyOn(usersService, 'findById').mockResolvedValue(null);

      const fakeToken = jwtService.sign({
        sub: '00000000-0000-0000-0000-000000000000',
        email: 'nonexistent@example.com',
        role: UserRole.USER,
      });

      await request(app.getHttpServer())
        .get('/mobile/auth/me')
        .set('Authorization', `Bearer ${fakeToken}`)
        .expect(401);
    });
  });

  describe('PATCH /mobile/auth/me', () => {
    it('should update user profile with valid data', async () => {
      // Reset the default mock for authentication
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser);

      const updatedUser = {
        ...mockUser,
        phone: '+84 912 345 678',
        bankAccountNumber: '123-456-789',
        bankCode: '004',
        bankName: 'HSBC',
      };

      jest.spyOn(usersService, 'updateProfile').mockResolvedValue(updatedUser);

      const response = await request(app.getHttpServer())
        .patch('/mobile/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          phone: '+84 912 345 678',
          bankAccountNumber: '123-456-789',
          bankCode: '004',
          bankName: 'HSBC',
        })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('phone', '+84 912 345 678');
      expect(response.body.data).toHaveProperty('bankAccountNumber', '123-456-789');
      expect(response.body.data).toHaveProperty('bankCode', '004');
      expect(response.body.data).toHaveProperty('bankName', 'HSBC');
      expect(usersService.updateProfile).toHaveBeenCalledWith(testUserId, {
        phone: '+84 912 345 678',
        bankAccountNumber: '123-456-789',
        bankCode: '004',
        bankName: 'HSBC',
      });
    });

    it('should update partial user profile fields', async () => {
      // Reset the default mock for authentication
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser);

      const updatedUser = {
        ...mockUser,
        phone: '+84 999 888 999',
      };

      jest.spyOn(usersService, 'updateProfile').mockResolvedValue(updatedUser);

      const response = await request(app.getHttpServer())
        .patch('/mobile/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          phone: '+84 999 888 999',
        })
        .expect(200);

      expect(response.body.data).toHaveProperty('phone', '+84 999 888 999');
      expect(usersService.updateProfile).toHaveBeenCalledWith(testUserId, {
        phone: '+84 999 888 999',
        bankAccountNumber: undefined,
        bankCode: undefined,
        bankName: undefined,
      });
    });

    it('should reject unauthenticated request', async () => {
      await request(app.getHttpServer())
        .patch('/mobile/auth/me')
        .send({
          phone: '+84 912 345 678',
        })
        .expect(401);
    });

    it('should reject invalid token', async () => {
      await request(app.getHttpServer())
        .patch('/mobile/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          phone: '+84 912 345 678',
        })
        .expect(401);
    });

    it('should validate request body', async () => {
      // Reset the default mock for authentication
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser);

      await request(app.getHttpServer())
        .patch('/mobile/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          phone: 12345, // Invalid - should be string
        })
        .expect(400);
    });
  });
});
