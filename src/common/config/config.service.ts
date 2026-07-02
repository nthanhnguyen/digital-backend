import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  get<T = string>(key: string): T {
    const value = process.env[key];
    return value as T;
  }

  getOrThrow<T = string>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined || value === null) {
      throw new Error(`Configuration key "${key}" is required but not set`);
    }
    return value;
  }
}
