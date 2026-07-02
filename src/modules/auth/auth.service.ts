import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { LoggerService, UnauthorizedError, ForbiddenError, ERRORS } from 'src/common';
import { UsersService } from '../users';
import { User, UserStatus } from '../users/users.interface';
import { AUTH_CONSTANTS } from './auth.const';
import { LoginType } from './auth.interface';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly logger: LoggerService,
  ) {
    this.googleClient = new OAuth2Client();
  }

  async validateGoogleToken(idToken: string, loginType: LoginType): Promise<User> {
    try {
      const GOOGLE_CLIENT_ID_MAP: Record<LoginType, string> = {
        [LoginType.PORTAL]: AUTH_CONSTANTS.GOOGLE_CLIENT_ID_PORTAL,
        [LoginType.MOBILE_IOS]: AUTH_CONSTANTS.GOOGLE_CLIENT_ID_MOBILE_IOS,
        [LoginType.MOBILE_ANDROID]: AUTH_CONSTANTS.GOOGLE_CLIENT_ID_MOBILE_ANDROID,
      };
      const googleClientId = GOOGLE_CLIENT_ID_MAP[loginType];

      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: googleClientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email || !payload.name) {
        throw new UnauthorizedError(ERRORS.AUTH_002, 'AUTH_002');
      }

      const { sub: googleSub, email, name } = payload;

      // Check if user exists by google_sub
      let user = await this.usersService.findByGoogleSub(googleSub);

      if (!user) {
        // Check if user exists by email
        user = await this.usersService.findByEmail(email);
        if (user) {
          // Link existing user with Google account
          user = await this.usersService.linkGoogleAccount(user.id, googleSub);
        } else {
          // Create new user
          user = await this.usersService.createFromGoogle({
            googleSub,
            email,
            name,
          });
        }
      }

      // Check if user account is suspended
      if (user.status === UserStatus.SUSPENDED) {
        this.logger.warn('Login attempt blocked - account suspended', { email, userId: user.id });
        throw new ForbiddenError(ERRORS.AUTH_003, 'AUTH_003');
      }

      this.logger.info('User authenticated successfully via Google', {
        userId: user.id,
        email: user.email,
      });

      return user;
    } catch (error) {
      // Re-throw ForbiddenError as-is (for suspended accounts)
      if (error instanceof ForbiddenError) {
        throw error;
      }

      this.logger.error('Google token validation failed', error);
      throw new UnauthorizedError(ERRORS.AUTH_002, 'AUTH_002');
    }
  }
}
