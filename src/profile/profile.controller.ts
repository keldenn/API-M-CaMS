import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfileService } from './profile.service';
import { UpdateEmailDto } from './dto/update-email.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { ProfileUpdateResponseDto } from './dto/profile-update-response.dto';

@ApiTags('profile')
@Controller('profile')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post('update/email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user email',
    description:
      'Updates email in `users` and `client_account` (cms22) for the authenticated user. Username and cd_code are taken from the JWT access token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Email updated successfully',
    type: ProfileUpdateResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid email' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User or client account not found' })
  async updateEmail(
    @Request() req: { user?: { username?: string; cd_code?: string } },
    @Body() dto: UpdateEmailDto,
  ): Promise<ProfileUpdateResponseDto> {
    const username = req.user?.username?.trim();
    const cd_code = req.user?.cd_code?.trim();

    if (!username || !cd_code) {
      throw new HttpException(
        'Username or CD code not found in token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.profileService.updateEmail(username, cd_code, dto);
  }

  @Post('update/phone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user phone',
    description:
      'Updates phone in `users` and `client_account` (cms22) for the authenticated user. Username and cd_code are taken from the JWT access token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Phone updated successfully',
    type: ProfileUpdateResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid phone number format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User or client account not found' })
  async updatePhone(
    @Request() req: { user?: { username?: string; cd_code?: string } },
    @Body() dto: UpdatePhoneDto,
  ): Promise<ProfileUpdateResponseDto> {
    const username = req.user?.username?.trim();
    const cd_code = req.user?.cd_code?.trim();

    if (!username || !cd_code) {
      throw new HttpException(
        'Username or CD code not found in token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.profileService.updatePhone(username, cd_code, dto);
  }
}
