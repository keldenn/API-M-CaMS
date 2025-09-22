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
    if (user && await this.verifyPassword(password, user.password, user.is_bcrypt)) {
      const { password: _, ...result } = user;
      return result;
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
      
      if (!userWithLinkData) {
        await this.recordFailedAttempt(username);
        return {
          error: true,
          message: 'Invalid Username or Password',
          data: null,
        };
      }

      // Verify password
      const passwordVerified = await this.verifyPassword(
        password,
        userWithLinkData.password,
        userWithLinkData.is_bcrypt
      );

      if (!passwordVerified) {
        await this.recordFailedAttempt(username);
        return {
          error: true,
          message: 'Invalid Password',
          data: null,
        };
      }

      // Check user status
      if (userWithLinkData.status === 0) {
        return {
          error: true,
          message: `Your Subscription has expired on: ${userWithLinkData.created_at.toISOString().substring(0, 10)}, Please renew.`,
          data: null,
        };
      }

      // Update password to bcrypt if needed
      if (!userWithLinkData.is_bcrypt) {
        await this.upgradeToBcrypt(username, password);
      }

      // Clear failed attempts on successful login
      await this.clearFailedAttempts(username);

      // Generate JWT token
      const payload = {
        sub: userWithLinkData.id,
        username: userWithLinkData.username,
        cd_code: userWithLinkData.cd_code,
      };
      const access_token = this.jwtService.sign(payload);

      // Prepare user data
      const userData: UserData = {
        cd_code: userWithLinkData.cd_code,
        name: userWithLinkData.name,
        email: userWithLinkData.email,
        username: userWithLinkData.username,
        broker_user_name: userWithLinkData.broker_user_name,
        participant_code: userWithLinkData.participant_code,
        profilePicture: userWithLinkData.profilePicture,
        isNRB: userWithLinkData.isNRB,
        cid: userWithLinkData.cid,
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
    const query = `
      SELECT 
        l.client_code as cd_code,
        l.participant_code,
        l.username,
        l.broker_user_name,
        u.id,
        u.name,
        u.email,
        u.password,
        u.cid,
        u.address,
        u.phone,
        u.profilePicture,
        u.status,
        u.role_id,
        u.isNRB,
        u.created_at,
        u.is_bcrypt
      FROM linkuser l, users u
      WHERE u.username = l.username AND u.username = ?
    `;

    const result = await this.userRepository.query(query, [username]);
    return result[0] || null;
  }

  private async verifyPassword(password: string, hashedPassword: string, isBcrypt: boolean): Promise<boolean> {
    if (isBcrypt) {
      return await bcrypt.compare(password, hashedPassword);
    } else {
      const md5Hash = crypto.createHash('md5').update(password).digest('hex');
      return md5Hash === hashedPassword;
    }
  }

  private async upgradeToBcrypt(username: string, password: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(password, 12);
    await this.userRepository.update(
      { username },
      { password: hashedPassword, is_bcrypt: true }
    );
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

