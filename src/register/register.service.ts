import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientAccount } from '../entities/client-account.entity';
import { BboCommission } from '../entities/bbo-commission.entity';
import { RegisterCdCodeDto } from './dto/register-cd-code.dto';

@Injectable()
export class RegisterService {
  constructor(
    @InjectRepository(ClientAccount, 'default')
    private clientAccountRepository: Repository<ClientAccount>,
    @InjectRepository(BboCommission, 'default')
    private bboCommissionRepository: Repository<BboCommission>,
  ) {}

  /**
   * Validates that ID has exactly 11 digits
   */
  private validateId(id: string): void {
    if (!id || id.length !== 11 || !/^\d+$/.test(id)) {
      throw new BadRequestException('ID must be exactly 11 digits');
    }
  }

  /**
   * Checks for duplicate CID within the same broker
   */
  private async checkDuplicateCid(id: string, userMemCode: string): Promise<void> {
    const count = await this.clientAccountRepository
      .createQueryBuilder('ca')
      .where('ca.ID = :id', { id })
      .andWhere('SUBSTRING(ca.user_name, 1, 7) = :memCode', { memCode: userMemCode })
      .getCount();

    if (count > 0) {
      throw new ConflictException('CID already registered with this broker');
    }
  }

  /**
   * Increments an existing CD code
   */
  private incrementCdCode(lastCdCode: string, brokerPrefix: string): string {
    // Extract the numeric part and increment
    const match = lastCdCode.match(/^(.+?)(\d+)$/);
    if (!match) {
      throw new BadRequestException(`Invalid CD code format: ${lastCdCode}`);
    }

    const prefix = match[1];
    const numberPart = match[2];
    const incrementedNumber = (parseInt(numberPart, 10) + 1).toString().padStart(numberPart.length, '0');
    
    return prefix + incrementedNumber;
  }

  /**
   * Creates the first CD code for a broker in a given year
   */
  private createFirstCdCode(brokerPrefix: string, fullYear: number, shortYear: number): string {
    const cdFormats: Record<string, string> = {
      'MEMBOBL': `B${fullYear}00001`,
      'MEMBNBL': `U${fullYear}00001`,
      'MEMRICB': `R${fullYear}00001`,
      'MEMBDBL': `BD${shortYear}000001`,
      'MEMBPCL': `BP${shortYear}000001`,
      'MEMRINS': `RN${shortYear}000001`,
      'MEMSERS': `SER${shortYear}00001`,
      'MEMDSBP': `DSB${shortYear}00001`,
      'MEMLDSB': `LDSB${shortYear}0001`,
    };

    return cdFormats[brokerPrefix] ?? `${brokerPrefix.slice(-4)}${shortYear}0001`;
  }

  /**
   * Generates CD code for individual client
   */
  private async generateIndividualCdCode(
    userMemCode: string,
    username: string,
    year: number,
  ): Promise<string> {
    const shortYear = year % 100;

    // Get last CD code for this broker in current year
    const lastRecord = await this.clientAccountRepository
      .createQueryBuilder('ca')
      .where('SUBSTRING(ca.user_name, 1, 7) = :memCode', { memCode: userMemCode })
      .andWhere('YEAR(ca.ca_date) = :year', { year })
      .orderBy('ca.client_id', 'DESC')
      .getOne();

    if (lastRecord && lastRecord.cd_code) {
      // Increment existing sequence
      return this.incrementCdCode(lastRecord.cd_code, userMemCode);
    } else {
      // Create first CD code for this broker/year
      return this.createFirstCdCode(userMemCode, year, shortYear);
    }
  }

  /**
   * Checks if CD code already exists globally
   */
  private async checkCdCodeUniqueness(cdCode: string): Promise<void> {
    const count = await this.clientAccountRepository
      .createQueryBuilder('ca')
      .where('ca.cd_code = :cdCode', { cdCode })
      .getCount();

    if (count > 0) {
      throw new ConflictException('CD Code already exists');
    }
  }

  /**
   * Fetches bro_comm_id from bbo_commission table based on institution_id and rate
   */
  private async getBroCommIdByInstitution(institutionId: number): Promise<number | undefined> {
    try {
      // Use raw query to handle decimal comparison more reliably
      // Using the exact query format from the user's specification
      let result = await this.bboCommissionRepository.query(
        `SELECT b.bro_comm_id FROM bbo_commission AS b WHERE b.institution_id = ? AND b.rate = 1.0`,
        [institutionId]
      );

      // If no result, try with CAST for better decimal comparison
      if (!result || result.length === 0) {
        result = await this.bboCommissionRepository.query(
          `SELECT b.bro_comm_id FROM bbo_commission AS b WHERE b.institution_id = ? AND CAST(b.rate AS DECIMAL(10,2)) = 1.0`,
          [institutionId]
        );
      }

      if (result && result.length > 0 && result[0].bro_comm_id) {
        return result[0].bro_comm_id;
      }

      return undefined;
    } catch (error) {
      console.error('Error fetching bro_comm_id:', error);
      return undefined;
    }
  }

  /**
   * Main method to register client account with CD code
   */
  async registerCdCode(registerDto: RegisterCdCodeDto): Promise<{ message: string; cd_code: string; client_id: number }> {
    // Step 1: Validate ID has 11 digits
    this.validateId(registerDto.ID);

    // Step 2: Get broker prefix from username (first 7 characters)
    const userMemCode = registerDto.user_name.substring(0, 7);

    // Step 3: Check for duplicate CID within same broker
    await this.checkDuplicateCid(registerDto.ID, userMemCode);

    // Step 4: Generate CD code (cd_code should not be sent, it will be generated)
    const currentYear = new Date().getFullYear();
    let cdCode = registerDto.cd_code;

    if (!cdCode) {
      // Generate CD code with retry logic in case of conflicts
      let attempts = 0;
      const maxAttempts = 10;
      
      do {
        cdCode = await this.generateIndividualCdCode(userMemCode, registerDto.user_name, currentYear);
        attempts++;
        
        // Check if generated code already exists
        try {
          await this.checkCdCodeUniqueness(cdCode);
          break; // Code is unique, exit loop
        } catch (error) {
          if (attempts >= maxAttempts) {
            throw new ConflictException('Unable to generate unique CD code after multiple attempts');
          }
          // If conflict, wait a bit and try again (increment will happen on next query)
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } while (attempts < maxAttempts);
    } else {
      // If CD code is provided, validate it doesn't exist
      await this.checkCdCodeUniqueness(cdCode);
    }

    // Step 5: Get bro_comm_id from bbo_commission if institution_id is provided and bro_comm_id is not provided
    let broCommId = registerDto.bro_comm_id;
    if (!broCommId && registerDto.institution_id) {
      broCommId = await this.getBroCommIdByInstitution(registerDto.institution_id);
      if (!broCommId) {
        throw new NotFoundException(`No broker commission found for institution_id ${registerDto.institution_id} with rate 1.0`);
      }
    }

    // Step 6: Insert into client_account table
    const clientAccount = new ClientAccount();
    clientAccount.acc_type = 'I'; // Set acc_type to "I" statically
    clientAccount.cd_code = cdCode;
    clientAccount.title = registerDto.title || null;
    clientAccount.f_name = registerDto.f_name || null;
    clientAccount.l_name = registerDto.l_name || null;
    clientAccount.occupation = registerDto.occupation || null;
    clientAccount.nationality = 'BHUTANESE'; // Set nationality to "BHUTANESE" statically
    clientAccount.ID = registerDto.ID || null;
    clientAccount.DzongkhagID = registerDto.DzongkhangID || null;
    clientAccount.gewog_id = registerDto.gewog_id || null;
    clientAccount.village_id = registerDto.village_id || null;
    clientAccount.tpn = registerDto.tpn || null;
    clientAccount.phone = registerDto.phone ? String(registerDto.phone) : null;
    clientAccount.email = registerDto.email || null;
    clientAccount.bank_id = registerDto.bank_id || null;
    clientAccount.bank_account = registerDto.bank_account || null;
    clientAccount.bank_account_type = 'Savings'; // Set bank_account_type to "Savings" statically
    clientAccount.bro_comm_id = broCommId || null;
    clientAccount.address = registerDto.address || null;
    clientAccount.institution_id = registerDto.institution_id ? String(registerDto.institution_id) : null;
    clientAccount.license_no = registerDto.licenseNo || null;
    clientAccount.dob = registerDto.dob ? new Date(registerDto.dob) : null;
    clientAccount.guardian_name = registerDto.guardian_name || null;
    clientAccount.gender = registerDto.gender || null;
    clientAccount.marital_status = registerDto.marital || null;
    clientAccount.user_name = registerDto.user_name || null;
    clientAccount.ca_date = new Date();

    const savedAccount = await this.clientAccountRepository.save(clientAccount);

    return {
      message: 'Client account created successfully',
      cd_code: cdCode,
      client_id: savedAccount.client_id,
    };
  }
}

