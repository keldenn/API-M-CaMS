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
        AND ap.status = 1
      WHERE 
        ca.acc_type = 'I'
        AND ca.ID = ?;
    `;

    const result = await this.cms22DataSource.query<
      Pick<CdCodeResponseDto, 'cd_code' | 'institution_id' | 'name'>[]
    >(
      query,
      [cid],
    );
    if (result.length === 0) {
      return [];
    }

    const institutionIds = [
      ...new Set(
        result
          .map((row) => row.institution_id?.toString().trim())
          .filter((institutionId): institutionId is string =>
            Boolean(institutionId),
          ),
      ),
    ];
    const cdCodes = [
      ...new Set(
        result
          .map((row) => row.cd_code?.trim())
          .filter((code): code is string => Boolean(code)),
      ),
    ];
    const mcamsUsers = await this.findMcamsUsers(
      cid,
      institutionIds,
      cdCodes,
    );

    return result.map((item) => {
      const cdCode = item.cd_code?.trim();
      const institutionId = item.institution_id?.toString().trim();
      const usersForInstitution = mcamsUsers.filter((user) => {
        const userCdCode = user.cd_code?.trim();
        const userInstitutionId = user.institution_id?.toString().trim();

        if (cdCode && userCdCode) {
          return userCdCode === cdCode;
        }

        return Boolean(institutionId) && userInstitutionId === institutionId;
      });

      return {
        ...item,
        has_mcams: usersForInstitution.length > 0,
        is_mcams_active: usersForInstitution.some(
          (user) => Number(user.status) === 1,
        ),
      };
    });
  }

  /**
   * Preferred match: users.cd_code. Fallback for null/empty users.cd_code:
   * users.participant_code -> adm_participants.participant_code -> institution_id.
   */
  private findMcamsUsers(
    cid: string,
    institutionIds: string[],
    cdCodes: string[],
  ): Promise<{ cd_code: string | null; institution_id: string; status: number }[]> {
    const usernameSuffix = `%${cid}`;
    const cdCodePlaceholders = cdCodes.map(() => '?').join(', ');
    const institutionPlaceholders = institutionIds.map(() => '?').join(', ');

    const cdCodePredicate =
      cdCodes.length > 0 ? `u.cd_code IN (${cdCodePlaceholders})` : '1 = 0';
    const institutionPredicate =
      institutionIds.length > 0
        ? `ap.institution_id IN (${institutionPlaceholders})`
        : '1 = 0';

    return this.cms22DataSource.query(
      `
        SELECT DISTINCT
          u.cd_code,
          ap.institution_id,
          u.status
        FROM users u
        LEFT JOIN adm_participants ap
          ON ap.participant_code = u.participant_code
          AND ap.status = 1
        WHERE u.role_id = 4
          AND (u.cid = ? OR u.username LIKE ?)
          AND (
            (${cdCodePredicate})
            OR (
              COALESCE(TRIM(u.cd_code), '') = ''
              AND ${institutionPredicate}
            )
          )
      `,
      [cid, usernameSuffix, ...cdCodes, ...institutionIds],
    );
  }
}
