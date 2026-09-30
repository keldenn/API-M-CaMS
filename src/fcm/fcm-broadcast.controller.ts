import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { FcmService } from './fcm.service';
import { BroadcastKeyGuard } from './guards/broadcast-key.guard';

@ApiTags('FCM')
@Controller('fcm')
export class FcmBroadcastController {
  constructor(private readonly fcmService: FcmService) {}

  @Public()
  @UseGuards(BroadcastKeyGuard)
  @Post('broadcast')
  @ApiOperation({
    summary: 'Send one push notification to every registered device',
    description:
      'Admin broadcast. Requires the x-broadcast-key header matching FCM_BROADCAST_KEY. Not a user JWT route.',
  })
  @ApiResponse({ status: 201, description: 'Broadcast attempted' })
  @ApiResponse({ status: 401, description: 'Invalid broadcast key' })
  @ApiResponse({ status: 503, description: 'FCM_BROADCAST_KEY is not set' })
  async broadcast(@Body() dto: BroadcastNotificationDto) {
    const title = dto.title.trim();
    const body = dto.body.trim();
    if (!title || !body) {
      throw new BadRequestException('Title and description are required');
    }
    return this.fcmService.sendBroadcastNotification(title, body);
  }
}
