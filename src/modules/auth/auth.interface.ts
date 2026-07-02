import { UserRole } from '../users/users.interface';

export { UserRole };

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export enum LoginType {
  PORTAL = 'PORTAL',
  MOBILE_IOS = 'MOBILE_IOS',
  MOBILE_ANDROID = 'MOBILE_ANDROID',
}
