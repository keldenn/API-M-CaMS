import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class BondVolRequestDto {
  @ApiProperty({ example: 'RICB00001', description: 'Client CD code' })
  @IsString()
  @IsNotEmpty()
  cd_code!: string;

  @ApiProperty({ example: 123, description: 'Symbol ID' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  symbol_id!: number;
}

export class BondVolResponseDto {
  @ApiProperty({ example: 1500.5 })
  volume!: number;
}
