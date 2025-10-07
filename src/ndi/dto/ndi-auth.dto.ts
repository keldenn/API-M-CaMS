import { IsString, IsNotEmpty, IsNumber, IsArray, IsObject, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

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
}

export class NdiProofResponseDto {
  @IsNumber()
  statusCode: number;

  @IsString()
  message: string;

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

export class NdiVerificationInitiateDto {
  @IsString()
  @IsOptional()
  proofName?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => NdiVerificationAttributeDto)
  attributes?: NdiVerificationAttributeDto[];
}

export class NdiVerificationAttributeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  schemaName: string;
}

export class NdiVerificationResponseDto {
  proofRequest: NdiProofResponseDto;
  deepLinkUrl: string;
  qrCodeUrl: string;
  threadId: string;
}
