import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { CdCodeRequestDto } from './dto/cd-code-request.dto';
import { CdCodeResponseDto } from './dto/cd-code-response.dto';

@Injectable()
export class CdCodeService {
  private readonly logger = new Logger(CdCodeService.name);

  constructor(
    @InjectDataSource('cms22')
    private readonly cms22DataSource: DataSource,
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

    const result = await this.cms22DataSource.query<CdCodeResponseDto[]>(
      query,
      [cid],
    );

    const cdCodes = [
      ...new Set(
        result
          .map((row) => row.cd_code?.trim())
          .filter((code): code is string => Boolean(code)),
      ),
    ];

    const mcamsUsers = await this.findMcamsUsers(cid, cdCodes);

    const has_mcams = mcamsUsers.length > 0;
    const is_mcams_active = mcamsUsers.some(
      (user) => Number(user.status) === 1,
    );

    return result.map((item) => ({
      ...item,
      has_mcams,
      is_mcams_active,
    }));
  }

  /**
   * mCaMS usernames are participant_code + cid (e.g. MEMBNBL10906002173).
   * Match cid column, cd_code, or username suffix when cid in users differs from client_account.ID.
   */
  private findMcamsUsers(
    cid: string,
    cdCodes: string[],
  ): Promise<{ status: number }[]> {
    const usernameSuffix = `%${cid}`;

    if (cdCodes.length > 0) {
      const placeholders = cdCodes.map(() => '?').join(', ');
      return this.cms22DataSource.query(
        `SELECT status FROM users
         WHERE role_id = 4
           AND (cid = ? OR username LIKE ? OR cd_code IN (${placeholders}))`,
        [cid, usernameSuffix, ...cdCodes],
      );
    }

    return this.cms22DataSource.query(
      `SELECT status FROM users
       WHERE role_id = 4
         AND (cid = ? OR username LIKE ?)`,
      [cid, usernameSuffix],
    );
  }
}
