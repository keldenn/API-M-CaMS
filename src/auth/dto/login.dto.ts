import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Username for authentication',
    example: 'username',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'Password for authentication',
    example: 'password',
    minLength: 4,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  password: string;
}

