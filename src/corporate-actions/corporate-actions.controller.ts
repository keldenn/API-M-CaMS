import { Controller, Get, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CorporateActionsService } from './corporate-actions.service';
import { CorporateActionsResponseDto } from './dto/corporate-actions-response.dto';
import { AgmResponseDto } from './dto/agm-response.dto';
import { SingleScriptResponseDto } from './dto/single-script-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Company')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CorporateActionsController {
  constructor(private readonly corporateActionsService: CorporateActionsService) {}

  @Get('corporate-actions/:script')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get corporate actions by script',
    description: 'Retrieve corporate actions for a specific stock script symbol ordered by year in ascending order.',
  })
  @ApiParam({
    name: 'script',
    description: 'Stock script symbol (e.g., BNBL)',
    example: 'BNBL',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Corporate actions retrieved successfully',
    type: [CorporateActionsResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Script parameter is required',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - No corporate actions found for the specified script',
  })
  async getCorporateActionsByScript(@Param('script') script: string): Promise<CorporateActionsResponseDto[]> {
    return this.corporateActionsService.getCorporateActionsByScript(script);
  }

  @Get('fetch-agm/:script')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get AGM data by script',
    description: 'Retrieve AGM (Annual General Meeting) information for a specific stock script symbol.',
  })
  @ApiParam({
    name: 'script',
    description: 'Stock script symbol (e.g., BNBL)',
    example: 'BNBL',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'AGM data retrieved successfully',
    type: [AgmResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Script parameter is required',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - No AGM data found for the specified script',
  })
  async getAgmByScript(@Param('script') script: string): Promise<AgmResponseDto[]> {
    return this.corporateActionsService.getAgmByScript(script);
  }

  @Get('fetch-single-script/:script')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get single script details by symbol',
    description: 'Retrieve details for a single script such as sector, paid up shares, address, date of establishment, and website link.',
  })
  @ApiParam({
    name: 'script',
    description: 'Stock script symbol (e.g., BNBL)',
    example: 'BNBL',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Script details retrieved successfully',
    type: [SingleScriptResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Script parameter is required',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - No script found for the specified symbol',
  })
  async getSingleScript(@Param('script') script: string): Promise<SingleScriptResponseDto[]> {
    return this.corporateActionsService.getSingleScriptBySymbol(script);
  }
}

