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
      // Use the same password verification logic as in login
      const password_db = user.password;
      const isBcrypt = user.is_bcrypt;
      const passwordVerified = isBcrypt ? 
        await bcrypt.compare(password, password_db) : 
        (crypto.createHash('md5').update(password).digest('hex') === password_db);
      
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
    if (VerificationAPI !== 'RSEB@2020') {
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
        message: 'Account has been locked due to more than 5 incorrect attempts.',
        data: null,
      };
    }

    try {
      // Find user with link data
      const userWithLinkData = await this.findUserWithLinkData(username);
      
      console.log('Debug - User lookup result:', {
        username: username,
        userFound: !!userWithLinkData,
        userData: userWithLinkData ? {
          username: userWithLinkData.username,
          name: userWithLinkData.name,
          email: userWithLinkData.email
        } : null
      });
      
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
      
      // Debug logging
      console.log('Debug - User found:', {
        username: userWithLinkData.username,
        password_db: password_db,
        isBcrypt: isBcrypt,
        input_password: password,
        md5_hash: crypto.createHash('md5').update(password).digest('hex')
      });
      
      let passwordVerified = false;
      
      if (isBcrypt) {
        // For PHP bcrypt compatibility, try both methods
        try {
          // First try standard bcrypt comparison
          passwordVerified = await bcrypt.compare(password, password_db);
          console.log('Standard bcrypt result:', passwordVerified);
        } catch (error) {
          console.log('Standard bcrypt failed, trying PHP-compatible method');
          // If that fails, try PHP-compatible bcrypt
          const bcryptjs = require('bcryptjs');
          passwordVerified = bcryptjs.compareSync(password, password_db);
          console.log('PHP-compatible bcrypt result:', passwordVerified);
        }
        
        // Also try with different password variations
        console.log('Trying password variations:');
        console.log('Original password:', password);
        console.log('Password with different case:', password.toLowerCase());
        console.log('Password with different case:', password.toUpperCase());
        
        // Try with trimmed password
        const trimmedPassword = password.trim();
        if (trimmedPassword !== password) {
          console.log('Trying trimmed password:', trimmedPassword);
          try {
            const trimmedResult = await bcrypt.compare(trimmedPassword, password_db);
            console.log('Trimmed bcrypt result:', trimmedResult);
            if (trimmedResult) passwordVerified = true;
          } catch (error) {
            const bcryptjs = require('bcryptjs');
            const trimmedResult = bcryptjs.compareSync(trimmedPassword, password_db);
            console.log('Trimmed PHP-compatible bcrypt result:', trimmedResult);
            if (trimmedResult) passwordVerified = true;
          }
        }
      } else {
        // MD5 comparison
        passwordVerified = (crypto.createHash('md5').update(password).digest('hex') === password_db);
        console.log('MD5 comparison result:', passwordVerified);
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

    return attempts >= 5;
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

