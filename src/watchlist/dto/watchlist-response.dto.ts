import { ApiProperty } from '@nestjs/swagger';

export class WatchlistResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Symbol added to watchlist.' })
  message: string;

  @ApiProperty({
    description: 'Row id when a new row was inserted',
    required: false,
    example: 42,
  })
  id?: number;
}
