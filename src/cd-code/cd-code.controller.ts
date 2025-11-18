import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CdCodeService } from './cd-code.service';
import { CdCodeRequestDto } from './dto/cd-code-request.dto';
import { CdCodeResponseDto } from './dto/cd-code-response.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('cd_code')
@Controller('cd_code')
export class CdCodeController {
  constructor(private readonly cdCodeService: CdCodeService) {}

  @Post('all')
  @Public()
  @ApiOperation({
    summary: 'Retrieve cd_code details for client accounts',
    description:
      "Runs the institutional account lookup against the 'cms22' database and returns the CD code, institution identifier, and participant name. If the request body is omitted, the default identifier '10811000167' is used.",
  })
  @ApiHeader({
    name: 'cd_code',
    required: false,
    description: 'Optional identifier supplied via header (logged for traceability only)',
  })
  @ApiBody({
    type: CdCodeRequestDto,
    required: false,
    description: 'Request payload containing the client account identifier (cid)',
  })
  @ApiOkResponse({
    description: 'List of cd_code details',
    type: CdCodeResponseDto,
    isArray: true,
  })
  async findAll(
    @Headers('cd_code') cdCodeHeader: string | undefined,
    @Body() requestDto: CdCodeRequestDto,
  ): Promise<CdCodeResponseDto[]> {
    return this.cdCodeService.findAll(cdCodeHeader, requestDto);
  }
}

