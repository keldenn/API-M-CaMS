import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsEmail,
  IsDateString,
  Matches,
  Length,
  IsOptional,
} from 'class-validator';

export class RegisterCdCodeDto {
  @ApiProperty({
    description: 'Account type (e.g., "I" for Individual)',
    example: 'I',
    required: false,
  })
  @IsOptional()
  @IsString()
  acc_type?: string;

  @ApiProperty({
    description: 'CD Code (will be generated if not provided)',
    required: false,
  })
  @IsOptional()
  @IsString()
  cd_code?: string;

  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  f_name: string;

  @ApiProperty({
    description: 'Citizen ID (must be 11 digits)',
    example: '12345678901',
  })
  @IsString()
  @IsNotEmpty()
  @Length(11, 11, { message: 'ID must be exactly 11 digits' })
  @Matches(/^\d+$/, { message: 'ID must contain only digits' })
  ID: string;

  @ApiProperty({ description: 'Dzongkhang ID', example: 1 })
  @IsInt()
  @IsNotEmpty()
  DzongkhangID: number;

  @ApiProperty({ description: 'Gewog ID', example: 1 })
  @IsInt()
  @IsNotEmpty()
  gewog_id: number;

  @ApiProperty({ description: 'Village ID', example: 1 })
  @IsInt()
  @IsNotEmpty()
  village_id: number;

  @ApiProperty({ description: 'Phone number', example: 17123456 })
  @IsInt()
  @IsNotEmpty()
  phone: number;

  @ApiProperty({ description: 'Email address', example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Bank ID', example: 1 })
  @IsInt()
  @IsNotEmpty()
  bank_id: number;

  @ApiProperty({ description: 'Bank account number', example: '1234567890' })
  @IsString()
  @IsNotEmpty()
  bank_account: string;

  @ApiProperty({
    description:
      'Broker commission ID (will be fetched from bbo_commission if not provided)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  bro_comm_id?: number;

  @ApiProperty({ description: 'Title (Mr, Mrs, Ms, etc.)', example: 'Mr' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Bank account type', example: 'Savings' })
  @IsString()
  @IsNotEmpty()
  bank_account_type: string;

  @ApiProperty({ description: 'Date of birth', example: '1990-01-01' })
  @IsDateString()
  @IsNotEmpty()
  dob: string;

  @ApiProperty({ description: 'Gender', example: 'Male' })
  @IsString()
  @IsNotEmpty()
  gender: string;

  @ApiProperty({ description: 'Username', example: 'MEMBOBL123456' })
  @IsString()
  @IsNotEmpty()
  user_name: string;

  // Optional fields
  @ApiProperty({ description: 'Last name', required: false })
  @IsOptional()
  @IsString()
  l_name?: string;

  @ApiProperty({ description: 'Occupation', required: false })
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiProperty({ description: 'Nationality', required: false })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiProperty({ description: 'TPN', required: false })
  @IsOptional()
  @IsString()
  tpn?: string;

  @ApiProperty({ description: 'Address', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ description: 'Institution ID', required: false })
  @IsOptional()
  @IsInt()
  institution_id?: number;

  @ApiProperty({ description: 'License number', required: false })
  @IsOptional()
  @IsString()
  licenseNo?: string;

  @ApiProperty({ description: 'Guardian name', required: false })
  @IsOptional()
  @IsString()
  guardian_name?: string;

  @ApiProperty({ description: 'Marital status', required: false })
  @IsOptional()
  @IsString()
  marital?: string;
}
