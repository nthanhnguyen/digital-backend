import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';
import { UsersModule } from '../users';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { AUTH_CONSTANTS } from './auth.const';
import { LoggerModule } from 'src/common';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: AUTH_CONSTANTS.JWT_SECRET,
      signOptions: { expiresIn: AUTH_CONSTANTS.JWT_EXPIRATION as StringValue },
    }),
    UsersModule,
    LoggerModule,
  ],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, UsersModule],
})
export class AuthModule {}
