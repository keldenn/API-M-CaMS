import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, NatsConnection, StringCodec, Subscription } from 'nats';
import { nkeyAuthenticator } from 'nats';
import { NdiProofResultDto } from '../dto/ndi-auth.dto';

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsService.name);
  private nc: NatsConnection | null = null;
  private readonly sc = StringCodec();
  private readonly subscriptions = new Map<string, Subscription>();
  private readonly natsUrl: string;
  private readonly natsSeed: string;

  constructor(private configService: ConfigService) {
    this.natsUrl = this.configService.get<string>(
      'ndi.natsUrl',
      'nats://app.rsebl.org.bt:4222',
    );
    this.natsSeed = this.configService.get<string>(
      'ndi.natsSeed',
      'SUAESNRWPPICEM4PF5MWARPD46HZ3KJIVK7LBEUIFE6A4FUANTNI7HG6VE',
    );
  }

  async onModuleInit() {
    try {
      await this.connect();
    } catch (error) {
      this.logger.error('Failed to connect to NATS:', error.message);
      this.logger.warn(
        'Application will continue without NATS connection. NATS features will not be available.',
      );
    }
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      const seed = new TextEncoder().encode(this.natsSeed);

      this.nc = await connect({
        servers: this.natsUrl,
        authenticator: nkeyAuthenticator(seed),
        timeout: 10000, // 10 second timeout
      });

      this.logger.log(`Connected to NATS server: ${this.natsUrl}`);
    } catch (error) {
      this.logger.error('NATS connection failed:', error.message);
      throw error;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.nc) {
      // Close all subscriptions
      for (const [threadId, sub] of this.subscriptions) {
        sub.unsubscribe();
        this.logger.log(`Unsubscribed from thread: ${threadId}`);
      }
      this.subscriptions.clear();

      // Close connection
      await this.nc.close();
      this.nc = null;
      this.logger.log('Disconnected from NATS server');
    }
  }

  async subscribeToProofResult(
    threadId: string,
    callback: (result: NdiProofResultDto) => void,
  ): Promise<void> {
    if (!this.nc) {
      throw new Error('NATS connection not established');
    }

    try {
      const sub = this.nc.subscribe(threadId);
      this.subscriptions.set(threadId, sub);

      this.logger.log(`Subscribed to proof result for thread: ${threadId}`);

      // Process messages asynchronously
      (async () => {
        try {
          for await (const msg of sub) {
            try {
              const messageData = this.sc.decode(msg.data);
              this.logger.log(
                `Received message for thread ${threadId}: ${messageData}`,
              );

              // Parse the message as JSON
              const parsed: any = JSON.parse(messageData);

              // Some messages arrive as { pattern, data, ... }; normalize payload
              const payload: any = parsed?.data ?? parsed;

              // Derive a normalized status string
              const rawStatus: string | undefined =
                payload?.status ||
                payload?.verification_result ||
                parsed?.status;

              const status = this.normalizeStatus(rawStatus);

              // Build a normalized proof result
              const proofResult: NdiProofResultDto = {
                threadId,
                status,
                // Prefer a concise object of revealed attributes when available
                proofData: this.extractProofData(payload),
                timestamp: new Date().toISOString(),
              };

              // Call the callback function with normalized result
              callback(proofResult);
            } catch (parseError) {
              this.logger.error(
                `Failed to parse message for thread ${threadId}:`,
                parseError.message,
              );
            }
          }
        } catch (error) {
          this.logger.error(
            `Error processing messages for thread ${threadId}:`,
            error.message,
          );
        }
      })();
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to thread ${threadId}:`,
        error.message,
      );
      throw error;
    }
  }

  private normalizeStatus(raw?: string): string {
    if (!raw) return 'pending';
    const v = String(raw).toLowerCase();
    // Map known NDI statuses
    if (
      v.includes('validated') ||
      v === 'verified' ||
      v === 'accept' ||
      v === 'accepted'
    ) {
      return 'verified';
    }
    if (v.includes('reject') || v === 'declined') {
      return 'rejected';
    }
    if (v.includes('expire')) {
      return 'expired';
    }
    return v;
  }

  private extractProofData(payload: any): any {
    if (!payload) return undefined;
    // If message follows Aries-like structure with requested_presentation
    const rp = payload.requested_presentation;
    if (rp?.revealed_attrs) {
      // Flatten revealed attributes into a simple key/value map
      const flattened: Record<string, any> = {};
      try {
        for (const [attrName, values] of Object.entries<any>(
          rp.revealed_attrs,
        )) {
          // values is often an array of { value, identifier_index }
          const first = Array.isArray(values) ? values[0] : values;
          const value = first?.value ?? first;

          // Map to the exact field names you want
          if (attrName === 'ID Number') {
            flattened.idNumber = value;
          } else if (attrName === 'Full Name') {
            flattened.fullName = value;
          } else if (attrName === 'Date of Birth') {
            flattened.dateOfBirth = value;
          } else {
            // Keep original attribute name for other fields
            flattened[attrName] = value;
          }
        }

        // Add verification timestamp
        flattened.verificationTimestamp = new Date().toISOString();

        return flattened;
      } catch (_) {
        // fallback to raw payload
        return payload;
      }
    }
    return payload;
  }

  async unsubscribeFromProofResult(threadId: string): Promise<void> {
    const sub = this.subscriptions.get(threadId);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(threadId);
      this.logger.log(`Unsubscribed from thread: ${threadId}`);
    }
  }

  async publishMessage(subject: string, data: any): Promise<void> {
    if (!this.nc) {
      throw new Error('NATS connection not established');
    }

    try {
      const message = JSON.stringify(data);
      this.nc.publish(subject, this.sc.encode(message));
      this.logger.log(`Published message to subject: ${subject}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish message to subject ${subject}:`,
        error.message,
      );
      throw error;
    }
  }

  isConnected(): boolean {
    return this.nc !== null && !this.nc.isClosed();
  }

  getConnectionStatus(): string {
    if (!this.nc) return 'disconnected';
    if (this.nc.isClosed()) return 'closed';
    return 'connected';
  }
}
