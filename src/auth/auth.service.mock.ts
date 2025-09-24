import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto, UserData } from './dto/login-response.dto';

@Injectable()
export class AuthServiceMock {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    // Mock validation - replace with real database logic later
    if (username === 'test_user' && password === 'password123') {
      return {
        id: 1,
        username: 'test_user',
        name: 'Test User',
        cd_code: 'TEST001',
      };
    }
    return null;
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const { username, password, VerificationAPI } = loginDto;

    // Verify API key
    if (VerificationAPI !== 'RSEB@2020') {
      return {
        error: true,
        message: 'Unauthorized.',
        data: null,
      };
    }

    // Mock authentication - replace with real database logic later
    if (username === 'test_user' && password === 'password123') {
      // Generate JWT token
      const payload = {
        sub: 1,
        username: 'test_user',
        cd_code: 'TEST001',
      };
      const access_token = this.jwtService.sign(payload);

      // Prepare user data
      const userData: UserData = {
        cd_code: 'TEST001',
        name: 'Test User',
        email: 'test@example.com',
        username: 'test_user',
        broker_user_name: 'broker_test',
        participant_code: 'PART001',
        profilePicture: null,
        isNRB: 0,
        cid: '11234567890',
      };

      return {
        error: false,
        message: 'Login Successful',
        data: userData,
        access_token,
      };
    }

    return {
      error: true,
      message: 'Invalid Username or Password',
      data: null,
    };
  }
}
