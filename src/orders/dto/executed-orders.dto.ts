import { ApiProperty } from '@nestjs/swagger';

export class ExecutedOrderItemDto {
  @ApiProperty({ description: 'Executed order ID', example: '1001' })
  exe_id: string;

  @ApiProperty({ description: 'CD Code', example: 'CD001' })
  cd_code: string;

  @ApiProperty({ description: 'Symbol ID', example: '1' })
  symbol_id: string;

  @ApiProperty({ description: 'Symbol', example: 'TBL' })
  symbol: string;

  @ApiProperty({ description: 'Order execution price', example: '120.50' })
  order_exe_price: string;

  @ApiProperty({ description: 'Executed lot size', example: '100' })
  lot_size_execute: string;

  @ApiProperty({ description: 'Order side - B for Buy, S for Sell', example: 'B' })
  side: string;

  @ApiProperty({ description: 'Order execution date', example: '2026-05-05 10:15:00' })
  order_date: string;
}

export class ExecutedOrdersResponseDto {
  @ApiProperty({ description: 'Success status', example: true })
  success: boolean;

  @ApiProperty({ description: 'Executed orders list', type: [ExecutedOrderItemDto] })
  data: ExecutedOrderItemDto[];

  @ApiProperty({ description: 'Total count', example: 3 })
  count: number;
}
