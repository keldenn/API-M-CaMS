import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { FcmTokenService } from './fcm-token.service';

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private firebaseApp: admin.app.App;

  constructor(
    private readonly configService: ConfigService,
    private readonly fcmTokenService: FcmTokenService,
  ) {}

  async onModuleInit() {
    this.initializeFirebase();
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private initializeFirebase() {
    try {
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
      const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

      if (!projectId || !clientEmail || !privateKey) {
        this.logger.error('Firebase configuration is missing in environment variables');
        throw new Error('Firebase configuration is incomplete');
      }

      // Parse the private key (handle escaped newlines)
      const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        }),
      });

      this.logger.log('✅ Firebase Admin SDK initialized successfully');
      this.logger.log(`📱 Project ID: ${projectId}`);
    } catch (error) {
      this.logger.error('❌ Failed to initialize Firebase Admin SDK:', error);
      throw error;
    }
  }

  /**
   * Send notification to a single device
   */
  async sendToDevice(
    token: string,
    payload: NotificationPayload,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const message: admin.messaging.Message = {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'order_updates',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);

      this.logger.log(`✅ Notification sent successfully. Message ID: ${response}`);

      // Update last_used_at
      await this.fcmTokenService.updateLastUsed([token]);

      return { success: true, messageId: response };
    } catch (error) {
      this.logger.error(`❌ Failed to send notification to device:`, error);

      // Check if token is invalid/expired
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        this.logger.warn(`Invalid token detected: ${token.substring(0, 20)}...`);
        // You could delete the invalid token here
      }

      return {
        success: false,
        error: error.message || 'Failed to send notification',
      };
    }
  }

  /**
   * Send notification to multiple devices
   */
  async sendToMultipleDevices(
    tokens: string[],
    payload: NotificationPayload,
  ): Promise<{
    success: boolean;
    successCount: number;
    failureCount: number;
    results: Array<{ token: string; success: boolean; error?: string }>;
  }> {
    if (!tokens || tokens.length === 0) {
      this.logger.warn('No tokens provided for sending notifications');
      return {
        success: false,
        successCount: 0,
        failureCount: 0,
        results: [],
      };
    }

    this.logger.log(`📤 Sending notification to ${tokens.length} device(s)`);

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'order_updates',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);

      this.logger.log(
        `✅ Multicast complete. Success: ${response.successCount}, Failure: ${response.failureCount}`,
      );

      // Update last_used_at for successful tokens
      const successfulTokens = tokens.filter(
        (_, index) => response.responses[index].success,
      );
      if (successfulTokens.length > 0) {
        await this.fcmTokenService.updateLastUsed(successfulTokens);
      }

      // Log failures
      const results = tokens.map((token, index) => {
        const result = response.responses[index];
        if (!result.success) {
          this.logger.warn(
            `Failed to send to token ${token.substring(0, 20)}...: ${result.error?.message}`,
          );
        }
        return {
          token: token.substring(0, 20) + '...',
          success: result.success,
          error: result.error?.message,
        };
      });

      return {
        success: response.successCount > 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
        results,
      };
    } catch (error) {
      this.logger.error('❌ Failed to send multicast notification:', error);
      return {
        success: false,
        successCount: 0,
        failureCount: tokens.length,
        results: tokens.map((token) => ({
          token: token.substring(0, 20) + '...',
          success: false,
          error: error.message,
        })),
      };
    }
  }

  /**
   * Send notification to all devices of a cd_code
   */
  async sendToCdCode(
    cdCode: string,
    payload: NotificationPayload,
  ): Promise<{
    success: boolean;
    successCount: number;
    failureCount: number;
  }> {
    this.logger.log(`📤 Sending notification to cd_code: ${cdCode}`);

    const tokens = await this.fcmTokenService.getActiveTokenStringsByCdCode(cdCode);

    if (tokens.length === 0) {
      this.logger.warn(`No FCM tokens found for cd_code: ${cdCode}`);
      return {
        success: false,
        successCount: 0,
        failureCount: 0,
      };
    }

    const result = await this.sendToMultipleDevices(tokens, payload);

    return {
      success: result.success,
      successCount: result.successCount,
      failureCount: result.failureCount,
    };
  }

  /**
   * Send order change notification
   */
  async sendOrderChangeNotification(
    cdCode: string,
    orderData: {
      order_id: string | number;
      symbol?: string;
      side?: string;
      price?: string | number;
      volume?: string | number;
      action: 'created' | 'updated' | 'deleted';
    },
  ): Promise<void> {
    let title = 'Order Update';
    let body = '';

    switch (orderData.action) {
      case 'created':
        title = '✅ Order Placed';
        body = `Your ${orderData.side === 'B' ? 'buy' : 'sell'} order for ${orderData.symbol || 'security'} has been placed successfully`;
        break;
      case 'updated':
        title = '🔄 Order Updated';
        body = `Your order #${orderData.order_id} has been updated`;
        break;
      case 'deleted':
        title = '❌ Order Cancelled';
        body = `Your ${orderData.side === 'B' ? 'buy' : 'sell'} order #${orderData.order_id} has been cancelled`;
        break;
    }

    const payload: NotificationPayload = {
      title,
      body,
      data: {
        type: 'order_change',
        action: orderData.action,
        order_id: orderData.order_id.toString(),
        cd_code: cdCode,
        timestamp: new Date().toISOString(),
      },
    };

    await this.sendToCdCode(cdCode, payload);
  }

  /**
   * Send price discovery notification
   * Notifies user when their order matches at the discovered price
   */
  async sendPriceDiscoveredNotification(
    cdCode: string,
    discoveryData: {
      symbol_id: number;
      symbol_name: string;
      price: string;
      side: 'B' | 'S';
      volume: number;
      order_id: number;
      maxTradable: number;
    },
  ): Promise<void> {
    const sideText = discoveryData.side === 'B' ? 'BUY' : 'SELL';
    const title = '🎯 Order Matched at Discovered Price!';
    const body = `Your ${sideText} order for ${discoveryData.symbol_name} at ₹${discoveryData.price} has been matched! Volume: ${discoveryData.volume.toLocaleString()}`;

    const payload: NotificationPayload = {
      title,
      body,
      data: {
        type: 'price_discovered',
        symbol_id: discoveryData.symbol_id.toString(),
        symbol_name: discoveryData.symbol_name,
        price: discoveryData.price,
        side: discoveryData.side,
        volume: discoveryData.volume.toString(),
        order_id: discoveryData.order_id.toString(),
        max_tradable: discoveryData.maxTradable.toString(),
        cd_code: cdCode,
        timestamp: new Date().toISOString(),
      },
    };

    this.logger.log(
      `📤 Sending price discovery notification to cd_code: ${cdCode} (${sideText} ${discoveryData.volume} @ ${discoveryData.price})`,
    );

    await this.sendToCdCode(cdCode, payload);
  }
}




