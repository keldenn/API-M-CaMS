import { registerAs } from '@nestjs/config';

export default registerAs('ndi', () => ({
  // NDI Authentication Configuration
  authUrl: process.env.NDI_AUTH_URL || 'https://core.bhutanndi.com/authentication/authenticate',
  clientId: process.env.NDI_CLIENT_ID,
  clientSecret: process.env.NDI_CLIENT_SECRET,
  
  // NDI Verifier Configuration
  verifierUrl: process.env.NDI_PROOF_REQUEST_URL || 'https://app.rsebl.org.bt/verifier/v1/proof-request',
  
  // NATS Configuration
  natsUrl: process.env.NDI_NATS_URL || 'nats://app.rsebl.org.bt:4222',
  natsSeed: process.env.NDI_NATS_SEED || 'SUAESNRWPPICEM4PF5MWARPD46HZ3KJIVK7LBEUIFE6A4FUANTNI7HG6VE',
  
  // Default Schema Configuration
  defaultSchema: process.env.NDI_SCHEMA_NAME || 'https://schema.ngotag.com/schemas/fb675203-b317-4675-a657-be7f5d1d57fb',
  
  // Backend API Key
  backendApiKey: process.env.BACKEND_API_KEY,
  
  // Timeout Configuration (in milliseconds)
  requestTimeout: parseInt(process.env.NDI_REQUEST_TIMEOUT || '30000'),
  tokenRefreshThreshold: parseInt(process.env.NDI_TOKEN_REFRESH_THRESHOLD || '300000'), // 5 minutes
  
  // Retry Configuration
  maxRetries: parseInt(process.env.NDI_MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.NDI_RETRY_DELAY || '1000'),
}));
