export const MAX_DATE = new Date('2999-12-31');
export const MIN_DATE = new Date('1970-01-01');

export const REQUEST_ID_HEADER_KEY = 'x-request-id';
export const USER_AGENT_HEADER_KEY = 'user-agent';

export type ISODateString = string;

export enum Environment {
  LOCAL = 'local',
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
}
