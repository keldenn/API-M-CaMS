import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FcmTokenService } from './fcm-token.service';
import { RegisterFcmTokenDto } from './dto/register-token.dto';
import { FcmResponseDto, FcmTokenListDto } from './dto/fcm-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('FCM')
@Controller('fcm')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class FcmController {
  constructor(private readonly fcmTokenService: FcmTokenService) {}

  @Post('register-token')
  @ApiOperation({
    summary: 'Register or update FCM token',
    description:
      'Register a new FCM token for push notifications or update existing token for the same device. If device_id exists, updates the token; otherwise creates new entry.',
  })
  @ApiResponse({
    status: 201,
    description: 'FCM token registered/updated successfully',
    type: FcmResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  async registerToken(
    @Body() registerTokenDto: RegisterFcmTokenDto,
  ): Promise<FcmResponseDto> {
    return this.fcmTokenService.registerToken(registerTokenDto);
  }

  @Get('tokens/:cd_code')
  @ApiOperation({
    summary: 'Get all FCM tokens for a cd_code',
    description:
      'Retrieve all registered FCM tokens for a specific cd_code (user). Returns list of all devices registered.',
  })
  @ApiParam({
    name: 'cd_code',
    description: 'CD code of the user',
    example: 'CD12345',
  })
  @ApiResponse({
    status: 200,
    description: 'FCM tokens retrieved successfully',
    type: FcmTokenListDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  async getTokens(
    @Param('cd_code') cdCode: string,
  ): Promise<FcmTokenListDto> {
    const tokens = await this.fcmTokenService.getTokensByCdCode(cdCode);

    return {
      success: true,
      tokens: tokens.map((token) => ({
        fcm_token_id: token.fcm_token_id,
        cd_code: token.cd_code,
        device_id: token.device_id,
        platform: token.platform,
        device_name: token.device_name,
        app_version: token.app_version,
        last_used_at: token.last_used_at,
        created_at: token.created_at,
      })),
      count: tokens.length,
    };
  }

  @Delete('token')
  @ApiOperation({
    summary: 'Delete FCM token',
    description:
      'Delete a specific FCM token by cd_code and device_id. Use this when user logs out or uninstalls the app.',
  })
  @ApiQuery({
    name: 'cd_code',
    description: 'CD code of the user',
    example: 'CD12345',
  })
  @ApiQuery({
    name: 'device_id',
    description: 'Device ID to delete token for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'FCM token deleted successfully',
    type: FcmResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'FCM token not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  async deleteToken(
    @Query('cd_code') cdCode: string,
    @Query('device_id') deviceId: string,
  ): Promise<FcmResponseDto> {
    return this.fcmTokenService.deleteToken(cdCode, deviceId);
  }

  @Delete('tokens/:cd_code')
  @ApiOperation({
    summary: 'Delete all FCM tokens for a cd_code',
    description:
      'Delete all FCM tokens for a specific cd_code. Use this when user account is deleted or deactivated.',
  })
  @ApiParam({
    name: 'cd_code',
    description: 'CD code of the user',
    example: 'CD12345',
  })
  @ApiResponse({
    status: 200,
    description: 'All FCM tokens deleted successfully',
    type: FcmResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  async deleteAllTokens(
    @Param('cd_code') cdCode: string,
  ): Promise<FcmResponseDto> {
    const result = await this.fcmTokenService.deleteAllTokensForCdCode(cdCode);
    return {
      success: result.success,
      message: result.message,
      data: { deleted_count: result.count },
    };
  }
}




