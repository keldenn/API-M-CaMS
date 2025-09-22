import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super();
  }

  async validate(username: string, password: string): Promise<any> {
    // Mock validation for testing
    if (username === 'test_user' && password === 'password123') {
      return {
        id: 1,
        username: 'test_user',
        name: 'Test User',
        cd_code: 'TEST001',
      };
    }
    throw new UnauthorizedException('Invalid credentials');
  }
}

