import { ApiProperty } from '@nestjs/swagger';

export class OrderResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Buy Order Placed successfully.',
  })
  message: string;
}
