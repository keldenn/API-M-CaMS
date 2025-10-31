import { ApiProperty } from '@nestjs/swagger';

export class SingleScriptResponseDto {
  @ApiProperty({ example: 'INSURANCE', description: 'Sector name' })
  sector: string;

  @ApiProperty({ example: '160005286', description: 'Paid up shares' })
  paid_up_shares: string;

  @ApiProperty({ example: 'Post Box 315 Norzin Lam, Thimphu', description: 'Company address' })
  address: string;

  @ApiProperty({ example: '1975', description: 'Date of establishment' })
  date_of_est: string;

  @ApiProperty({ example: 'https://www.ricb.bt/', description: 'Company website link' })
  website_link: string;
}


