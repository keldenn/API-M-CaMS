import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsIn,
  Min,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NewOrderDto {
  @ApiProperty({
    description: 'Order type identifier',
    example: 'MobileOrder',
  })
  @IsString()
  @IsNotEmpty()
  NewOrder: string;

  @ApiProperty({
    description: 'Price per share',
    example: 100.5,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  Price: number;

  @ApiProperty({
    description: 'Symbol ID',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  SymbolId: number;

  @ApiProperty({
    description: 'Participant Code',
    example: 'PART001',
  })
  @IsString()
  @IsNotEmpty()
  ParticipantCode: string;

  @ApiProperty({
    description: 'Broker Username',
    example: 'broker123',
  })
  @IsString()
  @IsNotEmpty()
  brokerUsername: string;

  @ApiProperty({
    description: 'User Name',
    example: 'user123',
  })
  @IsString()
  @IsNotEmpty()
  UserName: string;

  @ApiProperty({
    description: 'Order Side - B for Buy, S for Sell',
    example: 'B',
    enum: ['B', 'S'],
  })
  @IsString()
  @IsIn(['B', 'S'])
  @IsNotEmpty()
  OrderSide: string;

  @ApiProperty({
    description: 'CD Code',
    example: 'CD001',
  })
  @IsString()
  @IsNotEmpty()
  CdCode: string;

  @ApiProperty({
    description: 'Volume/Quantity',
    example: 100,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  Volume: number;
}
