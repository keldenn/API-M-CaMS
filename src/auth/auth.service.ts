import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../entities/user.entity';
import { LinkUser } from '../entities/linkuser.entity';
import { LoginAttempt } from '../entities/login-attempt.entity';
import { MobileApiLog } from '../entities/mobile-api-log.entity';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto, UserData } from './dto/login-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(LinkUser)
    private linkUserRepository: Repository<LinkUser>,
    @InjectRepository(LoginAttempt)
    private loginAttemptRepository: Repository<LoginAttempt>,
    @InjectRepository(MobileApiLog)
    private mobileApiLogRepository: Repository<MobileApiLog>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.findUserWithLinkData(username);
    if (user) {
      // Use the same password verification logic as in login (matching PHP exactly)
      const password_db = user.password;
      const isBcrypt = user.is_bcrypt;
      
      let passwordVerified = false;
      if (isBcrypt) {
        // Use bcryptjs for PHP compatibility (same as PHP's password_verify)
        const bcryptjs = require('bcryptjs');
        passwordVerified = bcryptjs.compareSync(password, password_db);
      } else {
        // MD5 comparison (same as PHP's md5($password) == $password_db)
        passwordVerified = (crypto.createHash('md5').update(password).digest('hex') === password_db);
      }
      
      if (passwordVerified) {
        const { password: _, ...result } = user;
        return result;
      }
    }
    return null;
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const { username, password, VerificationAPI } = loginDto;

        // Verify API key
        const expectedApiKey = this.configService.get<string>('VERIFICATION_API_KEY');
        if (!expectedApiKey) {
          throw new Error('VERIFICATION_API_KEY environment variable is required');
        }
        if (VerificationAPI !== expectedApiKey) {
      return {
        error: true,
        message: 'Unauthorized.',
        data: null,
      };
    }

    // Log API request
    await this.logApiRequest(loginDto, username);

    // Check login attempts
    const isLocked = await this.checkLoginAttempts(username);
    if (isLocked) {
      return {
        error: true,
        message: `Account has been locked due to more than ${this.configService.get<number>('LOGIN_ATTEMPTS_LIMIT') || 5} incorrect attempts.`,
        data: null,
      };
    }

    try {
      // Find user with link data
      const userWithLinkData = await this.findUserWithLinkData(username);
      
      
      if (!userWithLinkData) {
        await this.recordFailedAttempt(username);
        return {
          error: true,
          message: 'Invalid Username or Password',
          data: null,
        };
      }

      // Verify password (matching PHP logic exactly)
      const password_db = userWithLinkData.password;
      const isBcrypt = userWithLinkData.is_bcrypt;
      
      
      // Match PHP logic exactly: $passwordVerified = $isBcrypt ? password_verify($password, $password_db) : (md5($password) == $password_db);
      let passwordVerified = false;
      
      if (isBcrypt) {
        // Use bcryptjs for PHP compatibility (same as PHP's password_verify)
        const bcryptjs = require('bcryptjs');
        passwordVerified = bcryptjs.compareSync(password, password_db);
      } else {
        // MD5 comparison (same as PHP's md5($password) == $password_db)
        passwordVerified = (crypto.createHash('md5').update(password).digest('hex') === password_db);
      }

      if (!passwordVerified) {
        await this.recordFailedAttempt(username);
        return {
          error: true,
          message: 'Invalid Password',
          data: null,
        };
      }

      // Check user status (matching PHP logic)
      if (userWithLinkData.status === 0) {
        return {
          error: true,
          message: `Your Subscription has expired on: ${userWithLinkData.created_at ? userWithLinkData.created_at.toString().substring(0, 10) : 'unknown date'}, Please renew.`,
          data: null,
        };
      }

      // Update password to bcrypt if needed (matching PHP logic)
      if (!isBcrypt) {
        // Hash the new password using bcrypt
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Update the password and set is_bcrypt to true
        await this.userRepository.query(
          "UPDATE users SET password = ?, is_bcrypt = 1 WHERE username = ?",
          [hashedPassword, username]
        );
      }

      // Clear failed attempts on successful login
      await this.clearFailedAttempts(username);

      // Generate JWT token
      const payload = {
        sub: 1, // Use a default ID since we don't have user.id
        username: userWithLinkData.username,
        cd_code: userWithLinkData.cd_code,
      };
      const access_token = this.jwtService.sign(payload);

      // Prepare user data
      const userData: UserData = {
        cd_code: userWithLinkData.cd_code || '',
        name: userWithLinkData.name || '',
        email: userWithLinkData.email || '',
        username: userWithLinkData.username || '',
        broker_user_name: userWithLinkData.broker_user_name || '',
        participant_code: userWithLinkData.participant_code || '',
        profilePicture: userWithLinkData.profilePicture || null,
        isNRB: userWithLinkData.isNRB || 0,
        cid: userWithLinkData.cid || '',
      };

      return {
        error: false,
        message: 'Login Successful',
        data: userData,
        access_token,
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        error: true,
        message: 'An error occurred during login',
        data: null,
      };
    }
  }

  private async findUserWithLinkData(username: string): Promise<any> {
    // Match the exact PHP query structure
    const query = `
      SELECT
        l.client_code as cd_code,
        l.participant_code,
        l.username,
        l.broker_user_name,
        u.name,
        u.email,
        u.password,
        u.cid,
        u.address,
        u.phone,
        u.profilePicture,
        u.status as userstatus,
        u.role_id,
        u.isNRB,
        u.status,
        u.created_at, 
        u.is_bcrypt 
        FROM linkuser l, users u
        WHERE u.username=l.username AND u.username=?
    `;

    const result = await this.userRepository.query(query, [username]);
    return result[0] || null;
  }



  private async checkLoginAttempts(username: string): Promise<boolean> {
    const today = new Date().toISOString().substring(0, 10);
    const attempts = await this.loginAttemptRepository
      .createQueryBuilder('attempt')
      .where('attempt.username = :username', { username })
      .andWhere('DATE(attempt.date) = :today', { today })
      .getCount();

    const limit = this.configService.get<number>('LOGIN_ATTEMPTS_LIMIT') || 5;
    return attempts >= limit;
  }

  private async recordFailedAttempt(username: string): Promise<void> {
    const attempt = this.loginAttemptRepository.create({
      username,
      date: new Date(),
    });
    await this.loginAttemptRepository.save(attempt);
  }

  private async clearFailedAttempts(username: string): Promise<void> {
    const today = new Date().toISOString().substring(0, 10);
    await this.loginAttemptRepository
      .createQueryBuilder()
      .delete()
      .where('username = :username', { username })
      .andWhere('DATE(date) = :today', { today })
      .execute();
  }

  private async logApiRequest(loginDto: LoginDto, username: string): Promise<void> {
    const serializedPost = JSON.stringify(loginDto);
    const log = this.mobileApiLogRepository.create({
      date: new Date(),
      endpoint: serializedPost,
      user: username,
    });
    await this.mobileApiLogRepository.save(log);
  }
}

