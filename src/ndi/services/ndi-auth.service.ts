import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { NdiAuthRequestDto, NdiAuthResponseDto } from '../dto/ndi-auth.dto';

@Injectable()
export class NdiAuthService {
  private readonly logger = new Logger(NdiAuthService.name);
  private readonly authUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(private configService: ConfigService) {
    this.authUrl = this.configService.get<string>(
      'ndi.authUrl',
      'https://core.bhutanndi.com/authentication/authenticate',
    );
  }

  async authenticate(
    clientId: string,
    clientSecret: string,
    authUrl = this.authUrl,
  ): Promise<NdiAuthResponseDto> {
    try {
      this.logger.log(`Authenticating with NDI at: ${authUrl}`);
      this.logger.log(`Client ID: ${clientId}`);

      const authRequest: NdiAuthRequestDto = {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      };

      this.logger.log(
        'Auth request payload:',
        JSON.stringify(authRequest, null, 2),
      );

      const response = await axios.post(authUrl, authRequest, {
        headers: {
          'Content-Type': 'application/json',
          accept: '*/*',
        },
        timeout: 30000,
      });

      if (
        (response.status === 200 || response.status === 201) &&
        response.data.access_token
      ) {
        if (authUrl === this.authUrl) {
          this.accessToken = response.data.access_token;
          this.tokenExpiry = new Date(
            Date.now() + response.data.expires_in * 1000,
          );
        }

        this.logger.log('Successfully authenticated with NDI');
        return response.data;
      }

      throw new HttpException('Authentication failed', HttpStatus.UNAUTHORIZED);
    } catch (error) {
      this.logger.error('NDI Authentication failed:', error.message);

      if (error.response) {
        throw new HttpException(
          `NDI Authentication failed: ${error.response.data?.message || error.message}`,
          error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      throw new HttpException(
        'NDI Authentication service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async getValidAccessToken(): Promise<string> {
    const { clientId, clientSecret } = this.getClientCredentials();
    const authResponse = await this.authenticate(clientId, clientSecret);
    return authResponse.access_token;
  }

  /**
   * Token for POST /ndi/bill/submit only (demo bill-submitted API).
   * Uses NDI_AUTH_URL_STAGING; all other NDI flows keep prod NDI_AUTH_URL.
   */
  async getValidAccessTokenForStaging(): Promise<string> {
    const stagingAuthUrl = this.configService.get<string>('ndi.authUrlStaging');
    if (!stagingAuthUrl) {
      throw new HttpException(
        'NDI_AUTH_URL_STAGING is not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const { clientId, clientSecret } = this.getClientCredentials();
    const authResponse = await this.authenticate(
      clientId,
      clientSecret,
      stagingAuthUrl,
    );
    return authResponse.access_token;
  }

  private getClientCredentials(): { clientId: string; clientSecret: string } {
    const clientId = this.configService.get<string>('ndi.clientId');
    const clientSecret = this.configService.get<string>('ndi.clientSecret');

    if (!clientId || !clientSecret) {
      throw new HttpException(
        'NDI credentials not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { clientId, clientSecret };
  }

  isTokenValid(): boolean {
    return (
      this.accessToken !== null &&
      this.tokenExpiry !== null &&
      this.tokenExpiry > new Date()
    );
  }

  clearToken(): void {
    this.accessToken = null;
    this.tokenExpiry = null;
  }
}
