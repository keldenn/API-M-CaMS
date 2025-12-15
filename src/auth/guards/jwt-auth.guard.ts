import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    // If there's an error or no user, handle different JWT error types
    if (err || !user) {
      if (info instanceof TokenExpiredError) {
        throw new UnauthorizedException({
          message: 'Token expired',
          statusCode: 401,
        });
      }

      if (info instanceof JsonWebTokenError) {
        throw new UnauthorizedException({
          message: 'Unauthorized',
          statusCode: 401,
        });
      }

      // For other errors (like invalid token type)
      if (info && info.message) {
        throw new UnauthorizedException({
          message: info.message,
          statusCode: 401,
        });
      }

      // Generic unauthorized for any other case
      throw new UnauthorizedException({
        message: 'Unauthorized',
        statusCode: 401,
      });
    }

    return user;
  }
}
