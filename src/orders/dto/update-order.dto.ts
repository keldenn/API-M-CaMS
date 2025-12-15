import { IsString, IsNumber, IsNotEmpty, IsIn, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateOrderDto {
  @ApiProperty({ 
    description: 'Update order API identifier', 
    example: 'UpdateOrdersAPI' 
  })
  @IsString()
  @IsNotEmpty()
  UpdateOrdersAPI: string;

  @ApiProperty({ 
    description: 'Username', 
    example: 'user123' 
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ 
    description: 'Update Broker Username', 
    example: 'broker123' 
  })
  @IsString()
  @IsNotEmpty()
  updateBrokerUsername: string;

  @ApiProperty({ 
    description: 'Update Participant Code', 
    example: 'PART001' 
  })
  @IsString()
  @IsNotEmpty()
  updateParticipantCode: string;

  @ApiProperty({ 
    description: 'Order ID to update', 
    example: 12345 
  })
  @IsNumber()
  @IsNotEmpty()
  updateOrderId: number;

  @ApiProperty({ 
    description: 'Flag ID', 
    example: 240101123456 
  })
  @IsNumber()
  @IsNotEmpty()
  updateFlagId: number;

  @ApiProperty({ 
    description: 'Existing Volume', 
    example: 100 
  })
  @IsNumber()
  @IsNotEmpty()
  existingVolume: number;

  @ApiProperty({ 
    description: 'Update Volume', 
    example: 150,
    minimum: 1
  })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  updateVolume: number;

  @ApiProperty({ 
    description: 'Update Price', 
    example: 100.50,
    minimum: 0.01
  })
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  updatePrice: number;

  @ApiProperty({ 
    description: 'Order Side - B for Buy, S for Sell', 
    example: 'B',
    enum: ['B', 'S']
  })
  @IsString()
  @IsIn(['B', 'S'])
  @IsNotEmpty()
  updateSide: string;

  @ApiProperty({ 
    description: 'CD Code', 
    example: 'CD001' 
  })
  @IsString()
  @IsNotEmpty()
  updateCdCode: string;

  @ApiProperty({ 
    description: 'Symbol ID', 
    example: 1 
  })
  @IsNumber()
  @IsNotEmpty()
  updateSymbolId: number;
}

