import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RegisterService } from './register.service';
import { RegisterCdCodeDto } from './dto/register-cd-code.dto';
import { RegisterCdCodeResponseDto } from './dto/register-cd-code-response.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Register')
@Controller('register')
export class RegisterController {
  constructor(private readonly registerService: RegisterService) {}

  @Public()
  @Post('cd_code')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register client account with CD code',
    description: 'Creates a new client account with CD code generation. Validates ID, checks for duplicates, and generates unique CD code based on broker prefix.',
  })
  @ApiResponse({
    status: 201,
    description: 'Client account created successfully',
    type: RegisterCdCodeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation failed',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - CID or CD Code already exists',
  })
  async registerCdCode(@Body() registerDto: RegisterCdCodeDto): Promise<RegisterCdCodeResponseDto> {
    return this.registerService.registerCdCode(registerDto);
  }
}

