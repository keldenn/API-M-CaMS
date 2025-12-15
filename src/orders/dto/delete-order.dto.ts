import { IsString, IsNumber, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteOrderDto {
  @ApiProperty({ 
    description: 'Delete order API identifier', 
    example: 'DeleteOrderAPI' 
  })
  @IsString()
  @IsNotEmpty()
  DeleteOrderAPI: string;

  @ApiProperty({ 
    description: 'Username for API logging', 
    example: 'user123' 
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ 
    description: 'Order ID to delete', 
    example: 12345 
  })
  @IsNumber()
  @IsNotEmpty()
  deleteOrder_id: number;

  @ApiProperty({ 
    description: 'Flag ID', 
    example: 240101123456 
  })
  @IsNumber()
  @IsNotEmpty()
  deleteFid: number;

  @ApiProperty({ 
    description: 'Order Volume', 
    example: 100 
  })
  @IsNumber()
  @IsNotEmpty()
  deleteV: number;

  @ApiProperty({ 
    description: 'Order Side - B for Buy, S for Sell', 
    example: 'S',
    enum: ['B', 'S']
  })
  @IsString()
  @IsIn(['B', 'S'])
  @IsNotEmpty()
  deleteSide: string;

  @ApiProperty({ 
    description: 'CD Code', 
    example: 'CD001' 
  })
  @IsString()
  @IsNotEmpty()
  deleteCd_code: string;

  @ApiProperty({ 
    description: 'Symbol ID', 
    example: 1 
  })
  @IsNumber()
  @IsNotEmpty()
  deleteSy_id: number;
}

