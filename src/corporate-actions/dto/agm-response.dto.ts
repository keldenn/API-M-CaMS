import { ApiProperty } from '@nestjs/swagger';

export class AgmResponseDto {
  @ApiProperty({ example: '50th Annual General Meeting', description: 'Name of the AGM' })
  agm_name: string;

  @ApiProperty({ example: 'Hotel Druk, Thimphu', description: 'Venue of the AGM' })
  venue: string;

  @ApiProperty({ example: '2025-04-07 10:00 AM', description: 'Date and time of the AGM' })
  date: string;

  @ApiProperty({ example: '2025-03-13 04:40:32', description: 'Creation timestamp' })
  created_at: string;
}

