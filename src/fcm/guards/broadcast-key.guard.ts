import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

function keysMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

@Injectable()
export class BroadcastKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('FCM_BROADCAST_KEY')?.trim();
    if (!expected) {
      throw new ServiceUnavailableException(
        'Broadcast notifications are not configured',
      );
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const header = request.headers['x-broadcast-key'];
    const provided = (Array.isArray(header) ? header[0] : header)?.trim();

    if (!provided || !keysMatch(provided, expected)) {
      throw new UnauthorizedException('Invalid broadcast key');
    }

    return true;
  }
}
