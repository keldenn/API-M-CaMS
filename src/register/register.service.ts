import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ClientAccount } from '../entities/client-account.entity';
import { BboCommission } from '../entities/bbo-commission.entity';
import { ApiOnlineTerminal } from '../entities/api-online-terminal.entity';
import { Emd } from '../entities/emd.entity';
import { InvestmentTempResponse } from '../entities/investment-temp-response.entity';
import { RegisterCdCodeDto } from './dto/register-cd-code.dto';
import { SubmitUserDetailsDto } from './dto/submit-user-details.dto';
import { PaymentSuccessOtDto } from './dto/payment-success-ot.dto';
import { RegisterMcamsDto } from './dto/register-mcams.dto';

@Injectable()
export class RegisterService {
  constructor(
    @InjectRepository(ClientAccount, 'default')
    private clientAccountRepository: Repository<ClientAccount>,
    @InjectRepository(BboCommission, 'default')
    private bboCommissionRepository: Repository<BboCommission>,
    @InjectRepository(ApiOnlineTerminal, 'cms22')
    private apiOnlineTerminalRepository: Repository<ApiOnlineTerminal>,
    @InjectRepository(Emd, 'cms22')
    private emdRepository: Repository<Emd>,
    @InjectRepository(InvestmentTempResponse, 'cms22')
    private investmentTempResponseRepository: Repository<InvestmentTempResponse>,
    @InjectDataSource('cms22')
    private cms22DataSource: DataSource,
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

  /**
   * Submit user details for mCaMS registration (before payment)
   */
  async submitUserDetails(dto: SubmitUserDetailsDto): Promise<{
    status: string;
    message: string;
    email: string;
    app_fee: number;
    date: string;
    order_no: string;
  }> {
    const systime = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

    // Sanitize phone and email
    const phone = /^\d+$/.test(dto.phoneNo) ? dto.phoneNo : undefined;
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email) ? dto.email : 'default@example.com';

    const onlineTerminal = this.apiOnlineTerminalRepository.create({
      cid: dto.cidNo,
      cd_code: dto.cd_code,
      participant_code: dto.broker,
      name: dto.name,
      phone: phone,
      email: email,
      address: dto.address,
      declaration: 1,
      broker_user: dto.userName,
      status: 'AP',
      app_fee: dto.amount || 0,
      order_no: dto.orderNo,
      fee_status: '0',
    });

    const result = await this.apiOnlineTerminalRepository.save(onlineTerminal);

    if (result) {
      return {
        status: '200',
        message: 'Application submitted successfully.',
        email: email,
        app_fee: dto.amount || 0,
        date: systime,
        order_no: dto.orderNo,
      };
    } else {
      throw new BadRequestException('Something went wrong. Please try again later.');
    }
  }

  /**
   * Process payment success for mCaMS registration (OT)
   */
  async paymentSuccessOT(dto: PaymentSuccessOtDto): Promise<{ status: number; message: string }> {
    const queryRunner = this.cms22DataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Step 1: Update fee_status and cd_code in api_online_terminal
      const updateData: { fee_status: string; cd_code?: string } = { fee_status: '1' };
      if (dto.cd_code) {
        updateData.cd_code = dto.cd_code;
      }

      const updateResult = await queryRunner.manager
        .createQueryBuilder()
        .update(ApiOnlineTerminal)
        .set(updateData)
        .where('order_no = :orderNo', { orderNo: dto.orderNo })
        .andWhere('fee_status = :feeStatus', { feeStatus: '0' })
        .execute();

      if (updateResult.affected === 0) {
        throw new Error('Updating fee_status failed!');
      }

      // Step 2: Get the customer record
      const customer = await queryRunner.manager.findOne(ApiOnlineTerminal, {
        where: { order_no: dto.orderNo },
      });

      if (!customer) {
        throw new Error('Customer not found!');
      }

      // Step 3: Copy into emd table using raw query (matches PHP insertUsing)
      await queryRunner.query(
        `INSERT INTO emd (cid, cd_code, name, phone, email, app_fee, fee_status, order_no, user_online_id)
         SELECT cid, cd_code, name, phone, email, app_fee, fee_status, order_no, user_online_id
         FROM api_online_terminal WHERE order_no = ?`,
        [dto.orderNo]
      );

      // Step 4: Insert into investment_temp_response
      await queryRunner.query(
        `INSERT INTO investment_temp_response (order_number, investment_amount, auth_code, msg_type)
         VALUES (?, ?, '00', 'AC')`,
        [dto.orderNo, dto.fee || 0]
      );

      // Commit transaction
      await queryRunner.commitTransaction();

      return {
        status: 200,
        message: 'Application submitted successfully.',
      };
    } catch (error) {
      // Rollback on error
      await queryRunner.rollbackTransaction();
      throw new BadRequestException({
        status: 400,
        message: 'Transaction failed!',
        error: error.message,
      });
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Combined mCaMS registration: CD code registration + payment success OT
   * Both operations must succeed or both fail (transactional)
   */
  async registerMcams(dto: RegisterMcamsDto): Promise<{
    status: number;
    message: string;
    cd_code: string;
    client_id: number;
  }> {
    // Step 1: Validate ID has 11 digits
    this.validateId(dto.ID);

    // Step 2: Get broker prefix from username (first 7 characters)
    const userMemCode = dto.user_name.substring(0, 7);

    // Step 3: Check for duplicate CID within same broker
    await this.checkDuplicateCid(dto.ID, userMemCode);

    // Step 4: Generate CD code
    const currentYear = new Date().getFullYear();
    let cdCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      cdCode = await this.generateIndividualCdCode(userMemCode, dto.user_name, currentYear);
      attempts++;
      try {
        await this.checkCdCodeUniqueness(cdCode);
        break;
      } catch (error) {
        if (attempts >= maxAttempts) {
          throw new ConflictException('Unable to generate unique CD code after multiple attempts');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } while (attempts < maxAttempts);

    // Step 5: Get bro_comm_id from bbo_commission if institution_id is provided
    let broCommId = dto.bro_comm_id;
    if (!broCommId && dto.institution_id) {
      broCommId = await this.getBroCommIdByInstitution(dto.institution_id);
      if (!broCommId) {
        throw new NotFoundException(`No broker commission found for institution_id ${dto.institution_id} with rate 1.0`);
      }
    }

    // Start transaction for cms22 database
    const queryRunner = this.cms22DataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedClientId: number | undefined;

    try {
      // Step 6: Insert into client_account table (default database)
      const clientAccount = new ClientAccount();
      clientAccount.acc_type = 'I';
      clientAccount.cd_code = cdCode;
      clientAccount.title = dto.title || null;
      clientAccount.f_name = dto.f_name || null;
      clientAccount.l_name = dto.l_name || null;
      clientAccount.occupation = dto.occupation || null;
      clientAccount.nationality = 'BHUTANESE';
      clientAccount.ID = dto.ID || null;
      clientAccount.DzongkhagID = dto.DzongkhangID || null;
      clientAccount.gewog_id = dto.gewog_id || null;
      clientAccount.village_id = dto.village_id || null;
      clientAccount.tpn = dto.tpn || null;
      clientAccount.phone = dto.phone ? String(dto.phone) : null;
      clientAccount.email = dto.email || null;
      clientAccount.bank_id = dto.bank_id || null;
      clientAccount.bank_account = dto.bank_account || null;
      clientAccount.bank_account_type = 'Savings';
      clientAccount.bro_comm_id = broCommId || null;
      clientAccount.address = dto.address || null;
      clientAccount.institution_id = dto.institution_id ? String(dto.institution_id) : null;
      clientAccount.license_no = dto.licenseNo || null;
      clientAccount.dob = dto.dob ? new Date(dto.dob) : null;
      clientAccount.guardian_name = dto.guardian_name || null;
      clientAccount.gender = dto.gender || null;
      clientAccount.marital_status = dto.marital || null;
      clientAccount.user_name = dto.user_name || null;
      clientAccount.ca_date = new Date();

      const savedAccount = await this.clientAccountRepository.save(clientAccount);
      savedClientId = savedAccount.client_id;

      // Step 7: Create api_online_terminal record
      const fullName = [dto.f_name, dto.l_name].filter(Boolean).join(' ');
      const phone = String(dto.phone);
      const email = dto.email;

      const onlineTerminal = queryRunner.manager.create(ApiOnlineTerminal, {
        cid: dto.ID,
        cd_code: cdCode,
        participant_code: userMemCode,
        name: fullName,
        phone: phone,
        email: email,
        address: dto.address || undefined,
        declaration: 1,
        broker_user: dto.user_name,
        status: 'AP',
        app_fee: dto.fee || 0,
        order_no: dto.orderNo,
        fee_status: '0',
      });

      await queryRunner.manager.save(onlineTerminal);

      // Step 8: Update fee_status to '1'
      const updateResult = await queryRunner.manager
        .createQueryBuilder()
        .update(ApiOnlineTerminal)
        .set({ fee_status: '1', cd_code: cdCode })
        .where('order_no = :orderNo', { orderNo: dto.orderNo })
        .andWhere('fee_status = :feeStatus', { feeStatus: '0' })
        .execute();

      if (updateResult.affected === 0) {
        throw new Error('Updating fee_status failed!');
      }

      // Step 9: Copy into emd table
      await queryRunner.query(
        `INSERT INTO emd (cid, cd_code, name, phone, email, app_fee, fee_status, order_no, user_online_id)
         SELECT cid, cd_code, name, phone, email, app_fee, fee_status, order_no, user_online_id
         FROM api_online_terminal WHERE order_no = ?`,
        [dto.orderNo]
      );

      // Step 10: Insert into investment_temp_response
      await queryRunner.query(
        `INSERT INTO investment_temp_response (order_number, investment_amount, auth_code, msg_type)
         VALUES (?, ?, '00', 'AC')`,
        [dto.orderNo, dto.fee || 0]
      );

      // Step 11: Insert into users table
      // Username: participant_code + CID
      const username = userMemCode + dto.ID;
      // Hash password from request body with bcrypt
      const hashedPassword = await bcrypt.hash(String(dto.password), 12);
      const userRoleId = 4; // Static role_id = 4
      const userStatus = 1; // Active status
      const logCheck = 0; // Default log_check
      const isBcrypt = 1; // Static is_bcrypt = 1
      const amount = dto.fee || 0;
      const amtStatus = 1; // Same as fee_status (1 after payment success)
      const isPin = 1; // Static isPin = 1

      await queryRunner.query(
        `INSERT INTO users (name, username, password, role_id, participant_code, phone, email, status, log_check, address, cid, is_bcrypt, cd_code, amount, amt_status, orderNo, isPin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fullName,
          username,
          hashedPassword,
          userRoleId,
          userMemCode,
          phone,
          email,
          userStatus,
          logCheck,
          dto.address || '',
          dto.ID,
          isBcrypt,
          cdCode,
          amount,
          amtStatus,
          dto.orderNo,
          isPin,
        ]
      );

      // Step 12: Insert into linkuser table
      await queryRunner.query(
        `INSERT INTO linkuser (participant_code, client_code, username, broker_user_name)
         VALUES (?, ?, ?, ?)`,
        [
          userMemCode,
          cdCode,
          username,
          dto.user_name,
        ]
      );

      // Commit transaction
      await queryRunner.commitTransaction();

      return {
        status: 200,
        message: 'mCaMS registration completed successfully.',
        cd_code: cdCode,
        client_id: savedClientId,
      };
    } catch (error) {
      // Rollback cms22 transaction
      await queryRunner.rollbackTransaction();

      // Also delete the client_account if it was created
      if (savedClientId) {
        try {
          await this.clientAccountRepository.delete({ client_id: savedClientId });
        } catch (deleteError) {
          console.error('Failed to rollback client_account:', deleteError);
        }
      }

      throw new BadRequestException({
        status: 400,
        message: 'mCaMS registration failed!',
        error: error.message,
      });
    } finally {
      await queryRunner.release();
    }
  }
}

