import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import {
  RefreshTokenDto,
  RefreshTokenResponseDto,
} from './dto/refresh-token.dto';
import {
  ChangePasswordDto,
  ChangePasswordResponseDto,
} from './dto/change-password.dto';
import { ChangePinDto, ChangePinResponseDto } from './dto/change-pin.dto';
import {
  GetClientDetailsDto,
  ClientDetailsResponseDto,
} from './dto/forgot-password.dto';
import {
  ForgotChangePasswordDto,
  ForgotChangePasswordResponseDto,
} from './dto/forgot-change-password.dto';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticate user with username and password. Requires role_id = 4.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login attempt processed',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Role_id 4 required to login',
  })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Generate new access token using refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid refresh token',
  })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<RefreshTokenResponseDto> {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change user password',
    description:
      'Change user password using current password verification. Requires role_id = 4.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: ChangePasswordResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data or validation errors',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Role_id 4 required to change passwords',
  })
  async changePassword(
    @Request() req: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<ChangePasswordResponseDto> {
    return this.authService.changePassword(
      req.user.username,
      changePasswordDto,
    );
  }

  @Post('change-pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change user PIN',
    description:
      'Change user PIN using current PIN verification. Requires role_id = 4.',
  })
  @ApiResponse({
    status: 200,
    description: 'PIN changed successfully',
    type: ChangePinResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data or validation errors',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Role_id 4 required to change PINs',
  })
  async changePin(
    @Request() req: any,
    @Body() changePinDto: ChangePinDto,
  ): Promise<ChangePinResponseDto> {
    return this.authService.changePin(req.user.username, changePinDto);
  }

  @Public()
  @Post('forgot/client-details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get client details for forgot password',
    description:
      'Retrieve email and phone details using username for password reset verification',
  })
  @ApiResponse({
    status: 200,
    description: 'Client details retrieved successfully',
    type: ClientDetailsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Username not found',
  })
  async getClientDetails(
    @Body() getClientDetailsDto: GetClientDetailsDto,
  ): Promise<ClientDetailsResponseDto> {
    return this.authService.getClientDetails(getClientDetailsDto);
  }

  @Public()
  @Post('forgot/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change password for forgot password flow',
    description:
      'Change user password without authentication (for forgot password flow)',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: ForgotChangePasswordResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data or validation errors',
  })
  async forgotChangePassword(
    @Body() forgotChangePasswordDto: ForgotChangePasswordDto,
  ): Promise<ForgotChangePasswordResponseDto> {
    return this.authService.forgotChangePassword(forgotChangePasswordDto);
  }
}
