import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class WatchlistMutationDto {
  @ApiProperty({
    description: 'Client CD code (`users_watchlist.cd_code`); must match `fcm_tokens.cd_code` for push.',
    example: 'CD123456',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  cd_code: string;

  @ApiProperty({
    description: 'Ticker symbol',
    example: 'GP',
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  symbol: string;
}
