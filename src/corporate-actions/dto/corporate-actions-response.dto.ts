import { ApiProperty } from '@nestjs/swagger';

export class CorporateActionsResponseDto {
  @ApiProperty({ example: 'Dividend', description: 'Type of corporate action' })
  corporate_action: string;

  @ApiProperty({ example: '0', description: 'Amount of corporate action' })
  amount: string;

  @ApiProperty({ example: '', description: 'Remarks or notes', required: false })
  remarks: string;

  @ApiProperty({ example: '1993', description: 'Year of the corporate action' })
  year: string;
}

