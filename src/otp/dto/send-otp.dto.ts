import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  ValidateIf,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export function RequireEmailOrPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'requireEmailOrPhone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_: unknown, args: ValidationArguments) {
          const dto = args.object as SendOtpDto;
          return Boolean(dto.email || dto.phone_no);
        },
        defaultMessage() {
          return 'Email and phone number not found';
        },
      },
    });
  };
}

export class SendOtpDto {
  @ApiProperty({
    description: 'Email address to send OTP',
    example: 'user@example.com',
    required: false,
  })
  @Transform(emptyToUndefined)
  @RequireEmailOrPhone()
  @IsOptional()
  @ValidateIf((o: SendOtpDto) => o.email != null)
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiProperty({
    description: 'Phone number to send OTP',
    example: '12345678',
    required: false,
  })
  @Transform(emptyToUndefined)
  @RequireEmailOrPhone()
  @IsOptional()
  @ValidateIf((o: SendOtpDto) => o.phone_no != null)
  @IsString()
  @IsNotEmpty({ message: 'Please provide a valid phone number' })
  phone_no?: string;
}

export class SendOtpResponseDto {
  @ApiProperty()
  error: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  data?: string;
}
