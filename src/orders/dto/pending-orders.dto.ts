import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PendingOrdersRequestDto {
  @ApiProperty({ 
    description: 'Username to get pending orders for', 
    example: 'user123' 
  })
  @IsString()
  @IsNotEmpty()
  username: string;
}

export class PendingOrderItemDto {
  @ApiProperty({ description: 'CD Code', example: 'CD001' })
  cd_code: string;

  @ApiProperty({ description: 'Participant Code', example: 'PART001' })
  participant_code: string;

  @ApiProperty({ description: 'Member Broker', example: 'broker123' })
  member_broker: string;

  @ApiProperty({ description: 'Order Side - B for Buy, S for Sell', example: 'B' })
  side: string;

  @ApiProperty({ description: 'Order Date', example: '2024-01-01 10:00:00' })
  order_date: string;

  @ApiProperty({ description: 'Buy Volume', example: '100', nullable: true })
  buy_vol: string | null;

  @ApiProperty({ description: 'Sell Volume', example: '50', nullable: true })
  sell_vol: string | null;

  @ApiProperty({ description: 'Order Size', example: '100' })
  order_size: string;

  @ApiProperty({ description: 'Order ID', example: '12345' })
  order_id: string;

  @ApiProperty({ description: 'Symbol ID', example: '1' })
  symbol_id: string;

  @ApiProperty({ description: 'Price', example: '100.50' })
  price: string;

  @ApiProperty({ description: 'Commission Amount', example: '0.50' })
  commis_amt: string;

  @ApiProperty({ description: 'Flag ID', example: '240101123456' })
  flag_id: string;

  @ApiProperty({ description: 'Symbol', example: 'TBL' })
  symbol: string;
}

export class PendingOrdersResponseDto {
  @ApiProperty({ description: 'Success status', example: true })
  success: boolean;

  @ApiProperty({ description: 'Pending orders list', type: [PendingOrderItemDto] })
  data: PendingOrderItemDto[];

  @ApiProperty({ description: 'Total count', example: 5 })
  count: number;
}

