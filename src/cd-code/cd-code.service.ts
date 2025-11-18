import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { CdCodeRequestDto } from './dto/cd-code-request.dto';
import { CdCodeResponseDto } from './dto/cd-code-response.dto';

@Injectable()
export class CdCodeService {
  private readonly logger = new Logger(CdCodeService.name);

  constructor(
    @InjectDataSource('default')
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    cdCodeHeader: string | undefined,
    requestDto?: CdCodeRequestDto,
  ): Promise<CdCodeResponseDto[]> {
    const defaultCid = '10811000167';
    const cid = requestDto?.cid?.trim() || defaultCid;
    const cdCodeIdentifier = cdCodeHeader?.trim();

    this.logger.debug(
      `Executing cd_code query for cid: ${cid}${
        cdCodeIdentifier ? ` (header cd_code: ${cdCodeIdentifier})` : ''
      }`,
    );

    const query = `
      SELECT 
        ca.cd_code,
        ca.institution_id,
        ap.name
      FROM 
        client_account AS ca
      JOIN 
        adm_participants AS ap 
        ON ca.institution_id = ap.institution_id
      WHERE 
        ca.acc_type = 'I'
        AND ca.ID = ?;
    `;

    const result = await this.dataSource.query<CdCodeResponseDto[]>(query, [cid]);

    return result;
  }
}

