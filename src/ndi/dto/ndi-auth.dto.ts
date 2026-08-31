import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsObject,
  ValidateNested,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  DEFAULT_PROOF_ATTRIBUTES_EXAMPLE,
  DEFAULT_PROOF_NAME,
  IDENTITY_SCHEMA_FALLBACK,
  SUPPORTED_ATTRIBUTES,
} from '../constants/ndi-schemas';

export class NdiAuthRequestDto {
  @IsString()
  @IsNotEmpty()
  client_id: string;

  @IsString()
  @IsNotEmpty()
  client_secret: string;

  @IsString()
  @IsNotEmpty()
  grant_type: string = 'client_credentials';
}

export class NdiAuthResponseDto {
  @IsString()
  access_token: string;

  @IsString()
  token_type: string;

  @IsNumber()
  expires_in: number;
}

/** Purposes accepted by the NDI verifier proof-request API. */
export enum NdiProofPurpose {
  LOGIN = 'login',
  EKYC = 'ekyc',
  EKYC_UPDATE = 'ekyc_update',
  OTP = 'otp',
}

export class NdiProofAttributeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  restrictions: Array<{
    schema_name: string;
  }>;
}

export class NdiProofRequestDto {
  @IsString()
  @IsNotEmpty()
  proofName: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NdiProofAttributeDto)
  proofAttributes: NdiProofAttributeDto[];

  @IsEnum(NdiProofPurpose)
  purpose: NdiProofPurpose;
}

export class NdiProofResponseDto {
  @ApiProperty({ example: 201 })
  @IsNumber()
  statusCode: number;

  @ApiProperty({ example: 'Proof request created' })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Proof request details returned by the NDI verifier',
    example: {
      proofRequestName: DEFAULT_PROOF_NAME,
      proofRequestThreadId: '8f1c...-...',
      deepLinkURL: 'bhutanndi://...',
      proofRequestURL: 'https://app.rsebl.org.bt/verifier/v1/proof-request/...',
    },
  })
  data: {
    proofRequestName: string;
    proofRequestThreadId: string;
    deepLinkURL: string;
    proofRequestURL: string;
  };
}

export class NdiProofResultDto {
  @IsString()
  threadId: string;

  @IsString()
  status: string;

  @IsObject()
  proofData?: any;

  @IsString()
  timestamp: string;
}

export class NdiVerificationAttributeDto {
  @ApiProperty({
    description: 'Attribute name exactly as NDI reveals it',
    example: 'ID Number',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description:
      'Credential schema URL. Omit to let the server resolve it from NDI_SCHEMA_NAME / NDI_ADDRESS_SCHEMA_NAME based on the attribute name.',
    example: IDENTITY_SCHEMA_FALLBACK,
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  schemaName?: string;
}

@ApiExtraModels(NdiVerificationAttributeDto)
export class NdiVerificationInitiateDto {
  @ApiPropertyOptional({
    description: 'Proof request name shown in the Bhutan NDI wallet',
    example: DEFAULT_PROOF_NAME,
    default: DEFAULT_PROOF_NAME,
  })
  @IsString()
  @IsOptional()
  proofName?: string;

  @ApiPropertyOptional({
    description: 'Purpose of the proof request, as required by NDI.',
    enum: NdiProofPurpose,
    default: NdiProofPurpose.EKYC,
  })
  @IsEnum(NdiProofPurpose)
  @IsOptional()
  purpose?: NdiProofPurpose;

  @ApiPropertyOptional({
    description: `Attributes to request. Send plain names (schema resolved from env) or objects with an explicit schemaName. Supported names: ${SUPPORTED_ATTRIBUTES.join(', ')}. Omit to request all of them.`,
    example: DEFAULT_PROOF_ATTRIBUTES_EXAMPLE,
    default: DEFAULT_PROOF_ATTRIBUTES_EXAMPLE,
    type: 'array',
    items: {
      oneOf: [
        { type: 'string', example: 'ID Number' },
        { $ref: getSchemaPath(NdiVerificationAttributeDto) },
      ],
    },
  })
  @IsArray()
  @IsOptional()
  // Accepts either a plain attribute name or a full object. Instances are built
  // here rather than via @Type so the string shorthand still validates.
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((item) =>
          Object.assign(
            new NdiVerificationAttributeDto(),
            typeof item === 'string' ? { name: item } : item,
          ),
        )
      : value,
  )
  @ValidateNested({ each: true })
  attributes?: NdiVerificationAttributeDto[];
}

export class NdiVerificationResponseDto {
  @ApiProperty({ type: NdiProofResponseDto })
  proofRequest: NdiProofResponseDto;

  @ApiProperty({ description: 'Deep link that opens the Bhutan NDI app' })
  deepLinkUrl: string;

  @ApiProperty({ description: 'URL to render as a QR code' })
  qrCodeUrl: string;

  @ApiProperty({ description: 'Thread ID used to poll verification status' })
  threadId: string;
}
