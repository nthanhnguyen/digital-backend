import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UnauthorizedError, ERRORS } from 'src/common';
import { UsersService } from '../users';
import { User } from '../users/users.interface';
import { JwtPayload } from './auth.interface';
import { AUTH_CONSTANTS } from './auth.const';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: AUTH_CONSTANTS.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedError(ERRORS.AUTH_001, 'AUTH_001');
    }

    return user;
  }
}
