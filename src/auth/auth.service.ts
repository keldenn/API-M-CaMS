import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../entities/user.entity';
import { LinkUser } from '../entities/linkuser.entity';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto, UserData } from './dto/login-response.dto';
import { RefreshTokenDto, RefreshTokenResponseDto } from './dto/refresh-token.dto';
import { ChangePasswordDto, ChangePasswordResponseDto } from './dto/change-password.dto';
import { GetClientDetailsDto, ClientDetailsResponseDto } from './dto/forgot-password.dto';
import { ForgotChangePasswordDto, ForgotChangePasswordResponseDto } from './dto/forgot-change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(LinkUser)
    private linkUserRepository: Repository<LinkUser>,
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
    const { username, password } = loginDto;

    try {
      // Find user with link data
      const userWithLinkData = await this.findUserWithLinkData(username);
      
      if (!userWithLinkData) {
        return {
          error: true,
          message: 'Invalid Username or Password',
          data: null,
        };
      }

      // Check if user has the required role_id (4)
      console.log('Debug - User role_id:', userWithLinkData.role_id, 'Type:', typeof userWithLinkData.role_id);
      console.log('Debug - Role comparison:', userWithLinkData.role_id !== 4);
      console.log('Debug - Strict comparison:', userWithLinkData.role_id !== '4');
      
      // Convert to number for comparison since database might return string
      const userRoleId = parseInt(userWithLinkData.role_id);
      if (userRoleId !== 4) {
        return {
          error: true,
          message: `Access denied. Only users with role_id 4 can login. Your role_id: ${userRoleId}`,
          data: null,
        };
      }

      // Verify password
      const password_db = userWithLinkData.password;
      const isBcrypt = userWithLinkData.is_bcrypt;
      
      let passwordVerified = false;
      
      if (isBcrypt) {
        // Use bcryptjs for PHP compatibility
        const bcryptjs = require('bcryptjs');
        passwordVerified = bcryptjs.compareSync(password, password_db);
      } else {
        // MD5 comparison for legacy passwords
        passwordVerified = (crypto.createHash('md5').update(password).digest('hex') === password_db);
      }

      if (!passwordVerified) {
        return {
          error: true,
          message: 'Invalid Username or Password',
          data: null,
        };
      }

      // Check user status
      if (userWithLinkData.status === 0) {
        return {
          error: true,
          message: `Your Subscription has expired on: ${userWithLinkData.created_at ? userWithLinkData.created_at.toString().substring(0, 10) : 'unknown date'}, Please renew.`,
          data: null,
        };
      }

      // Update password to bcrypt if needed
      if (!isBcrypt) {
        const hashedPassword = await bcrypt.hash(password, 12);
        await this.userRepository.query(
          "UPDATE users SET password = ?, is_bcrypt = 1 WHERE username = ?",
          [hashedPassword, username]
        );
      }

      // Generate JWT access token (expires in 10 minutes)
      const accessPayload = {
        sub: 1,
        username: userWithLinkData.username,
        cd_code: userWithLinkData.cd_code,
        type: 'access',
      };
      const access_token = this.jwtService.sign(accessPayload);

      // Generate refresh token (expires in 2 days)
      const refreshPayload = {
        sub: 1,
        username: userWithLinkData.username,
        cd_code: userWithLinkData.cd_code,
        type: 'refresh',
      };
      const refresh_token = this.jwtService.sign(refreshPayload, {
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '2d',
      });

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
        refresh_token,
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

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
    const { refresh_token } = refreshTokenDto;

    try {
      // Verify the refresh token
      let decoded;
      try {
        decoded = this.jwtService.verify(refresh_token);
      } catch (error) {
        return {
          error: true,
          message: 'Invalid or expired refresh token',
        };
      }

      // Check if it's a refresh token
      if (decoded.type !== 'refresh') {
        return {
          error: true,
          message: 'Invalid token type',
        };
      }

      // Get user data to ensure user still exists and is active
      const userWithLinkData = await this.findUserWithLinkData(decoded.username);
      
      if (!userWithLinkData) {
        return {
          error: true,
          message: 'User not found',
        };
      }

      // Check user status
      if (userWithLinkData.status === 0) {
        return {
          error: true,
          message: 'User account is inactive',
        };
      }

      // Generate new access token
      const accessPayload = {
        sub: decoded.sub,
        username: decoded.username,
        cd_code: decoded.cd_code,
        type: 'access',
      };
      const access_token = this.jwtService.sign(accessPayload);

      return {
        error: false,
        message: 'Token refreshed successfully',
        access_token,
      };

    } catch (error) {
      console.error('Refresh token error:', error);
      return {
        error: true,
        message: 'An error occurred during token refresh',
      };
    }
  }

  async changePassword(username: string, changePasswordDto: ChangePasswordDto): Promise<ChangePasswordResponseDto> {
    const { currentPassword, newPassword, confirmPassword } = changePasswordDto;

    try {
      // Validate password confirmation
      if (newPassword !== confirmPassword) {
        return {
          error: true,
          message: 'New password and confirm password do not match',
        };
      }

      // Check if new password is different from current password
      if (currentPassword === newPassword) {
        return {
          error: true,
          message: 'New password must be different from current password',
        };
      }

      // Find user with link data
      const userWithLinkData = await this.findUserWithLinkData(username);
      
      if (!userWithLinkData) {
        return {
          error: true,
          message: 'User not found',
        };
      }

      // Check if user has the required role_id (4)
      console.log('Debug - Change Password - User role_id:', userWithLinkData.role_id, 'Type:', typeof userWithLinkData.role_id);
      
      // Convert to number for comparison since database might return string
      const userRoleId = parseInt(userWithLinkData.role_id);
      if (userRoleId !== 4) {
        return {
          error: true,
          message: `Access denied. Only users with role_id 4 can change passwords. Your role_id: ${userRoleId}`,
        };
      }

      // Verify current password
      const password_db = userWithLinkData.password;
      const isBcrypt = userWithLinkData.is_bcrypt;
      
      let currentPasswordVerified = false;
      
      if (isBcrypt) {
        // Use bcryptjs for PHP compatibility
        const bcryptjs = require('bcryptjs');
        currentPasswordVerified = bcryptjs.compareSync(currentPassword, password_db);
      } else {
        // MD5 comparison for legacy passwords
        currentPasswordVerified = (crypto.createHash('md5').update(currentPassword).digest('hex') === password_db);
      }

      if (!currentPasswordVerified) {
        return {
          error: true,
          message: 'Current password is incorrect',
        };
      }

      // Check user status
      if (userWithLinkData.status === 0) {
        return {
          error: true,
          message: 'User account is inactive',
        };
      }

      // Hash the new password using bcrypt
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);
      
      // Update the password in database
      await this.userRepository.query(
        "UPDATE users SET password = ?, is_bcrypt = 1 WHERE username = ?",
        [hashedNewPassword, username]
      );

      return {
        error: false,
        message: 'Password changed successfully',
      };

    } catch (error) {
      console.error('Change password error:', error);
      return {
        error: true,
        message: 'An error occurred while changing password',
      };
    }
  }

  async getClientDetails(getClientDetailsDto: GetClientDetailsDto): Promise<ClientDetailsResponseDto> {
    const { username } = getClientDetailsDto;

    try {
      // Find user with link data
      const userWithLinkData = await this.findUserWithLinkData(username);
      
      if (!userWithLinkData) {
        return {
          error: true,
          message: 'Username not found',
          data: null,
        };
      }

      // Check user status
      if (userWithLinkData.status === 0) {
        return {
          error: true,
          message: 'User account is inactive',
          data: null,
        };
      }

      // Return client details (unmasked)
      const clientDetails = {
        username: userWithLinkData.username,
        email: userWithLinkData.email,
        phone: userWithLinkData.phone,
      };

      return {
        error: false,
        message: 'Client details retrieved successfully',
        data: clientDetails,
      };

    } catch (error) {
      console.error('Get client details error:', error);
      return {
        error: true,
        message: 'An error occurred while retrieving client details',
        data: null,
      };
    }
  }

  async forgotChangePassword(forgotChangePasswordDto: ForgotChangePasswordDto): Promise<ForgotChangePasswordResponseDto> {
    const { username, newPassword, confirmPassword } = forgotChangePasswordDto;

    try {
      // Validate password confirmation
      if (newPassword !== confirmPassword) {
        return {
          error: true,
          message: 'New password and confirm password do not match',
        };
      }

      // Find user with link data
      const userWithLinkData = await this.findUserWithLinkData(username);
      
      if (!userWithLinkData) {
        return {
          error: true,
          message: 'User not found',
        };
      }

      // Check user status
      if (userWithLinkData.status === 0) {
        return {
          error: true,
          message: 'User account is inactive',
        };
      }

      // Hash the new password using bcrypt
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);
      
      // Update the password in database
      await this.userRepository.query(
        "UPDATE users SET password = ?, is_bcrypt = 1 WHERE username = ?",
        [hashedNewPassword, username]
      );

      return {
        error: false,
        message: 'Password changed successfully',
      };

    } catch (error) {
      console.error('Forgot change password error:', error);
      return {
        error: true,
        message: 'An error occurred while changing password',
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
}

