import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '../../common/infrastructure/http';
import { LoggerService } from '../../common/infrastructure/logger';
import { AirwallexConfigService } from './airwallex.config.service';
import { isHttpErrorWithResponse } from '../../common/types/http-error.types';

interface AirwallexTokenResponse {
  token: string;
  expires_in: number;
}

@Injectable()
export class AirwallexAuthService implements OnModuleInit {
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
    private readonly airwallexConfig: AirwallexConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Pre-fetch token on module initialization
    try {
      await this.getAccessToken();
      this.logger.info('Airwallex authentication initialized successfully');
    } catch (error) {
      this.logger.error(
        'Failed to initialize Airwallex authentication',
        error instanceof Error ? error.stack : String(error),
      );
      // Don't throw - allow lazy initialization on first API call
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    // Fetch new token
    return this.refreshToken();
  }

  /**
   * Refresh the access token from Airwallex API
   */
  async refreshToken(): Promise<string> {
    try {
      this.logger.info('Refreshing Airwallex access token');

      const response = await this.httpService.post<AirwallexTokenResponse>(
        this.airwallexConfig.authEndpoint,
        {},
        {
          headers: {
            'x-client-id': this.airwallexConfig.clientId,
            'x-api-key': this.airwallexConfig.apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      this.accessToken = response.data.token;
      // Set expiration 5 minutes before actual expiration for safety
      const expiresInSeconds = response.data.expires_in || 1800; // Default 30 minutes
      const bufferSeconds = 300; // 5 minute buffer
      this.tokenExpiresAt = new Date(Date.now() + (expiresInSeconds - bufferSeconds) * 1000);

      this.logger.info('Airwallex access token refreshed successfully', {
        expiresAt: this.tokenExpiresAt,
      });

      return this.accessToken;
    } catch (error) {
      this.logger.error(
        'Failed to refresh Airwallex access token',
        error instanceof Error ? error.stack : undefined,
        {
          error: error instanceof Error ? error.message : String(error),
          status: isHttpErrorWithResponse(error) ? error.response?.status : undefined,
        },
      );
      throw new Error('Failed to authenticate with Airwallex API');
    }
  }

  /**
   * Get authorization headers for API requests
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Clear the cached token (useful for testing or forced refresh)
   */
  clearToken(): void {
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }
}
