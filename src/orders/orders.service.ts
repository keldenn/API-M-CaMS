import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NewOrderDto } from './dto/new-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { DeleteOrderDto } from './dto/delete-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { PendingOrdersResponseDto, PendingOrderItemDto } from './dto/pending-orders.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectDataSource('cms22')
    private readonly cms22DataSource: DataSource,
  ) {}

  /**
   * Check if market is closed based on trading hours
   * Market is closed during: 09:55-10:05, 10:55-11:05, 11:55-12:05, 13:55-14:05, 14:55-15:05
   */
  private isMarketClosed(): boolean {
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 8); // HH:MM:SS format

    const closedWindows = [
      { start: '09:55:00', end: '10:05:00' },
      { start: '10:55:00', end: '11:05:00' },
      { start: '11:55:00', end: '12:05:00' },
      { start: '13:55:00', end: '14:05:00' },
      { start: '14:55:00', end: '15:05:00' },
    ];

    for (const window of closedWindows) {
      if (currentTime > window.start && currentTime < window.end) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get market price for a symbol
   */
  private async getMarketPrice(symbolId: number): Promise<number> {
    const query = `
      SELECT market_price 
      FROM market_price 
      WHERE symbol_id = ? 
      ORDER BY date DESC 
      LIMIT 1
    `;
    const result = await this.cms22DataSource.query(query, [symbolId]);
    return result.length > 0 ? parseFloat(result[0].market_price) : 0;
  }

  /**
   * Get circuit breaker value from circuit_breaker table
   */
  private async getCircuitBreaker(capName: string = 'CAP'): Promise<number> {
    const query = `SELECT margin FROM circuit_breaker WHERE name = ? AND status = 1 LIMIT 1`;
    const result = await this.cms22DataSource.query(query, [capName]);
    return result.length > 0 ? parseFloat(result[0].margin) : 0;
  }

  /**
   * Calculate cap value based on market price and circuit breaker
   */
  private calculateCapValue(
    marketPrice: number,
    circuitBreaker: number,
  ): number {
    return (marketPrice * circuitBreaker) / 100;
  }

  /**
   * Get commission rate for a CD code and broker
   */
  private async getCommission(
    cdCode: string,
    brokerUsername: string,
  ): Promise<number> {
    // Get institution_id from client_account table using cd_code
    const clientAccountQuery = `
      SELECT institution_id
      FROM client_account
      WHERE cd_code = ?
      LIMIT 1
    `;
    const clientAccountResult = await this.cms22DataSource.query(clientAccountQuery, [cdCode]);

    if (clientAccountResult.length > 0 && clientAccountResult[0].institution_id) {
      const institutionId = clientAccountResult[0].institution_id;
      // Convert to number if it's a string
      const instId = typeof institutionId === 'string' ? parseInt(institutionId, 10) : institutionId;
      
      if (instId) {
        const commissionQuery = `
          SELECT rate 
          FROM bbo_commission
          WHERE institution_id = ?
          LIMIT 1
        `;
        const commissionResult = await this.cms22DataSource.query(
          commissionQuery,
          [instId],
        );
        
        if (commissionResult.length > 0 && commissionResult[0].rate) {
          return parseFloat(commissionResult[0].rate);
        }
      }
    }
    
    // Default commission if not found
    return 0.5; // Default 0.5%
  }

  /**
   * Get client commission for TE (Trading Engine)
   */
  private async getClientCommissionTE(
    cdCode: string,
    brokerUsername: string,
  ): Promise<number> {
    return this.getCommission(cdCode, brokerUsername);
  }

  /**
   * Get total cash available for a client
   */
  private async getCashTotal(
    cdCode: string,
    brokerUsername: string,
  ): Promise<number> {
    const query = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM bbo_finance
      WHERE cd_code = ? AND status = 1
    `;
    const result = await this.cms22DataSource.query(query, [cdCode]);
    return result.length > 0 ? parseFloat(result[0].total) : 0;
  }

  /**
   * Get pending volumes for a symbol and CD code
   * Returns [available_volume, pending_out_vol, pending_in_vol]
   */
  private async getPendingVolumes(
    symbolId: number,
    cdCode: string,
  ): Promise<[number, number, number]> {
    const query = `
      SELECT 
        COALESCE(volume, 0) as volume,
        COALESCE(pending_out_vol, 0) as pending_out_vol,
        COALESCE(pending_in_vol, 0) as pending_in_vol
      FROM cds_holding
      WHERE symbol_id = ? AND cd_code = ?
      LIMIT 1
    `;
    const result = await this.cms22DataSource.query(query, [symbolId, cdCode]);

    if (result.length === 0) {
      return [0, 0, 0];
    }

    return [
      parseFloat(result[0].volume) || 0,
      parseFloat(result[0].pending_out_vol) || 0,
      parseFloat(result[0].pending_in_vol) || 0,
    ];
  }

  /**
   * Check if an order already exists for the given parameters
   * Returns 1 if exists, 0 if not
   */
  private async checkExistingOrder(
    cdCode: string,
    symbolId: number,
    side: string,
    participantCode: string,
  ): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM orders
      WHERE cd_code = ? 
        AND symbol_id = ? 
        AND side = ? 
        AND participant_code = ?
    `;
    const result = await this.cms22DataSource.query(query, [
      cdCode,
      symbolId,
      side,
      participantCode,
    ]);
    return parseInt(result[0].count, 10) > 0 ? 1 : 0;
  }

  /**
   * Get institution ID for a username
   * Tries multiple sources: client_account table (via linkuser), or users table
   */
  private async getInstitutionId(username: string): Promise<number | null> {
    // First, get cd_code from linkuser using username
    const linkuserQuery = `
      SELECT client_code
      FROM linkuser
      WHERE username = ?
      LIMIT 1
    `;
    const linkuserResult = await this.cms22DataSource.query(linkuserQuery, [username]);
    
    if (linkuserResult.length > 0 && linkuserResult[0].client_code) {
      const cdCode = linkuserResult[0].client_code;
      // Get institution_id from client_account using cd_code
      const clientAccountQuery = `
        SELECT institution_id
        FROM client_account
        WHERE cd_code = ?
        LIMIT 1
      `;
      const clientAccountResult = await this.cms22DataSource.query(clientAccountQuery, [cdCode]);
      if (clientAccountResult.length > 0 && clientAccountResult[0].institution_id) {
        const instId = clientAccountResult[0].institution_id;
        return typeof instId === 'string' ? parseInt(instId, 10) : instId;
      }
    }

    // Try client_account table directly via user_name
    const directQuery = `
      SELECT institution_id
      FROM client_account
      WHERE user_name = ?
      LIMIT 1
    `;
    const directResult = await this.cms22DataSource.query(directQuery, [username]);
    if (directResult.length > 0 && directResult[0].institution_id) {
      const instId = directResult[0].institution_id;
      return typeof instId === 'string' ? parseInt(instId, 10) : instId;
    }

    // Try users table (if it has institution_id)
    const usersQuery = `
      SELECT institution_id
      FROM users
      WHERE username = ?
      LIMIT 1
    `;
    const usersResult = await this.cms22DataSource.query(usersQuery, [username]);
    if (usersResult.length > 0 && usersResult[0].institution_id) {
      const instId = usersResult[0].institution_id;
      return typeof instId === 'string' ? parseInt(instId, 10) : instId;
    }

    return null;
  }

  /**
   * Create order audit entry in orders_audit table
   * Note: This function may fail silently if the orders_audit table doesn't exist
   */
  private async createOrderAudit(
    cdCode: string,
    participantCode: string,
    userName: string,
    volume: number,
    orderSize: number,
    symbolId: number,
    price: number,
    side: string,
    commissionAmt: number,
    flagId: string,
    brokerUserName: string,
  ): Promise<void> {
    try {
      // Insert into orders_audit table with correct column structure
      const query = `
        INSERT INTO orders_audit 
        (symbol_id, cd_code, participant_code, member_broker, order_size, order_entry, 
         buy_vol, sell_vol, price, side, commis_amt, flag_id, username, order_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      
      // Set buy_vol or sell_vol based on side
      const buyVol = side === 'B' ? Math.round(volume) : null;
      const sellVol = side === 'S' ? Math.round(volume) : null;
      
      // Convert flag_id to number for BIGINT column
      const flagIdNum = parseInt(flagId, 10) || 0;
      
      await this.cms22DataSource.query(query, [
        symbolId,
        cdCode,
        participantCode,
        brokerUserName,
        Math.round(orderSize),
        userName,
        buyVol,
        sellVol,
        price,
        side,
        commissionAmt,
        flagIdNum,
        userName,
      ]);
    } catch (error) {
      // Log error but don't fail the order if audit fails
      console.warn('Failed to create order audit entry:', error);
    }
  }

  /**
   * Log API request to mobile_api_log
   */
  private async logApiRequest(endpoint: string, user: string): Promise<void> {
    const query = `
      INSERT INTO mobile_api_log (date, endpoint, user)
      VALUES (NOW(), ?, ?)
    `;
    await this.cms22DataSource.query(query, [endpoint, user]);
  }

  /**
   * Check user status
   */
  private async checkUserStatus(username: string): Promise<number> {
    const query = `
      SELECT status 
      FROM users 
      WHERE username = ? AND role_id = 4
      LIMIT 1
    `;
    const result = await this.cms22DataSource.query(query, [username]);
    return result.length > 0 ? parseInt(result[0].status, 10) : 0;
  }

  /**
   * Process Buy Order
   */
  private async processBuyOrder(dto: NewOrderDto, brokerUserName: string): Promise<string> {
    const cdCode = dto.CdCode.trim().toUpperCase();
    const symbolId = dto.SymbolId;
    const participantCode = dto.ParticipantCode.trim();
    const userName = dto.UserName.trim();
    const volume = parseFloat(dto.Volume.toString());
    const price = parseFloat(dto.Price.toString().replace(/[^0-9.]/g, ''));
    const formattedPrice = parseFloat(price.toFixed(2));

    // Get pending volumes
    const [avlVol, pov, piv] = await this.getPendingVolumes(symbolId, cdCode);
    const n_pov = pov + volume;
    const n_piv = piv + volume;

    // Calculate commission and amount
    const b_commis = await this.getCommission(cdCode, brokerUserName);
    const commis_amt = (volume * formattedPrice * b_commis) / 100;
    const amt = volume * formattedPrice + commis_amt;

    const side = 'B';
    const flag = 3;
    const flag_id = this.generateFlagId();

    // Check for existing order
    const find_existing_order = await this.checkExistingOrder(
      cdCode,
      symbolId,
      side,
      participantCode,
    );
    if (find_existing_order === 1) {
      throw new BadRequestException(
        'Order For this symbol already exists, Consider updating instead.',
      );
    }

    // Check cash availability
    const b_commis_te = await this.getClientCommissionTE(
      cdCode,
      brokerUserName,
    );
    const tot = await this.getCashTotal(cdCode, brokerUserName);
    if (tot < amt) {
      throw new BadRequestException(
        `Insufficient Cash to Buy, You need to have atleast Nu. ${amt.toFixed(2)}`,
      );
    }

    // Check market hours
    if (this.isMarketClosed()) {
      throw new BadRequestException('Market Is Closed.');
    }

    // Get institution ID
    const institution_id = await this.getInstitutionId(userName);
    const remarks = `Buy ,Order entry by user ${userName} of member,${participantCode}of volume,${volume} @ Nu. ${formattedPrice} /share`;

    // Start transaction
    const queryRunner = this.cms22DataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create order audit
      await this.createOrderAudit(
        cdCode,
        participantCode,
        userName,
        volume,
        volume,
        symbolId,
        formattedPrice,
        side,
        commis_amt,
        flag_id,
        brokerUserName,
      );

      // Insert order
      const orderQuery = `
        INSERT INTO orders 
        (cd_code, participant_code, member_broker, order_entry, buy_vol, order_size, symbol_id, price, side, commis_amt, flag_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await queryRunner.query(orderQuery, [
        cdCode,
        participantCode,
        brokerUserName,
        userName,
        volume,
        volume,
        symbolId,
        formattedPrice,
        side,
        commis_amt,
        flag_id,
      ]);

      // Insert finance record
      const financeQuery = `
        INSERT INTO bbo_finance 
        (cd_code, amount, user_name, remarks, flag, institution_id, flag_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      await queryRunner.query(financeQuery, [
        cdCode,
        -amt,
        userName,
        remarks,
        flag,
        institution_id,
        flag_id,
      ]);

      // Special handling for M-CaMS institution (ID: 230822044455)
      const ins_id_mcams = 230822044455;
      if (institution_id === ins_id_mcams) {
        const mcamsQuery = `
          INSERT INTO mcams_wallet 
          (cd_code, amount, type, paid_to_user, trx_time, flag_id)
          VALUES (?, ?, 'DR', 'ORDER', NOW(), ?)
        `;
        await queryRunner.query(mcamsQuery, [cdCode, -amt, flag_id]);
      }

      await queryRunner.commitTransaction();
      return 'Buy Order Placed successfully.';
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Process Sell Order
   */
  private async processSellOrder(dto: NewOrderDto, brokerUserName: string): Promise<string> {
    const cdCode = dto.CdCode.trim().toUpperCase();
    const symbolId = dto.SymbolId;
    const participantCode = dto.ParticipantCode.trim();
    const userName = dto.UserName.trim();
    const volume = parseFloat(dto.Volume.toString());
    const price = parseFloat(dto.Price.toString().replace(/[^0-9.]/g, ''));
    const formattedPrice = parseFloat(price.toFixed(2));

    // Get pending volumes
    const [avlVol, pov, piv] = await this.getPendingVolumes(symbolId, cdCode);
    const n_pov = pov + volume;
    const new_vol_cds = avlVol - volume;

    // Calculate commission and amount
    const b_commis = await this.getCommission(cdCode, brokerUserName);
    const commis_amt = (volume * formattedPrice * b_commis) / 100;
    const amt = volume * formattedPrice + commis_amt;

    const side = 'S';
    const flag = 2;
    const flag_id = this.generateFlagId();
    const finstatus = 0;

    // Check for existing order
    const find_existing_order = await this.checkExistingOrder(
      cdCode,
      symbolId,
      side,
      participantCode,
    );
    if (find_existing_order === 1) {
      throw new BadRequestException(
        'Order For this symbol already exists, Consider updating instead.',
      );
    }

    // Check if user has enough shares
    if (volume > avlVol || avlVol === null || avlVol === 0) {
      throw new BadRequestException(
        'Sorry, you do not have enough shares to sell.',
      );
    }

    // Check market hours
    if (this.isMarketClosed()) {
      throw new BadRequestException('Market is Closed');
    }

    // Get institution ID
    const institution_id = await this.getInstitutionId(userName);
    const remarks = `Sell ,Order entry by user ${userName} of member,${participantCode}of volume,${volume} @ Nu. ${formattedPrice} /share`;

    // Start transaction
    const queryRunner = this.cms22DataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create order audit
      await this.createOrderAudit(
        cdCode,
        participantCode,
        userName,
        volume,
        volume,
        symbolId,
        formattedPrice,
        side,
        commis_amt,
        flag_id,
        brokerUserName,
      );

      // Insert order
      const orderQuery = `
        INSERT INTO orders 
        (cd_code, participant_code, member_broker, order_entry, sell_vol, order_size, symbol_id, price, side, commis_amt, flag_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await queryRunner.query(orderQuery, [
        cdCode,
        participantCode,
        brokerUserName,
        userName,
        volume,
        volume,
        symbolId,
        formattedPrice,
        side,
        commis_amt,
        flag_id,
      ]);

      // Insert finance record
      const financeQuery = `
        INSERT INTO bbo_finance 
        (cd_code, amount, user_name, remarks, flag, institution_id, flag_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await queryRunner.query(financeQuery, [
        cdCode,
        amt,
        userName,
        remarks,
        flag,
        institution_id,
        flag_id,
        finstatus,
      ]);

      // Update CDS holdings
      const updateHoldingQuery = `
        UPDATE cds_holding 
        SET volume = ?, pending_out_vol = ?
        WHERE cd_code = ? AND symbol_id = ?
      `;
      await queryRunner.query(updateHoldingQuery, [
        new_vol_cds,
        n_pov,
        cdCode,
        symbolId,
      ]);

      await queryRunner.commitTransaction();
      return 'Sell Order Placed Successfully.';
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Generate flag ID based on current timestamp
   */
  private generateFlagId(): string {
    const now = new Date();
    const year = now.getFullYear().toString().substring(2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Main method to create a new order
   */
  async createNewOrder(dto: NewOrderDto): Promise<OrderResponseDto> {
    // Static values
    const staticNewOrder = 'MobileOrder';
    const staticBrokerUsername = 'MEMRSEBIT';

    // Check user status
    const userStatus = await this.checkUserStatus(dto.UserName);
    if (userStatus === 0) {
      throw new BadRequestException(
        'Your credential has expired. Please renew it.',
      );
    }

    // Log API request (include static values in log for reference)
    const logData = {
      ...dto,
      NewOrder: staticNewOrder,
      brokerUsername: staticBrokerUsername,
    };
    const endpoint = JSON.stringify(logData);
    await this.logApiRequest(endpoint, dto.UserName);

    // Check price limits
    const marketPrice = await this.getMarketPrice(dto.SymbolId);
    const circuitBreaker = await this.getCircuitBreaker('CAP');
    const capValue = this.calculateCapValue(marketPrice, circuitBreaker);
    const upperLimit = Math.round((marketPrice + capValue) * 100) / 100;
    const lowerLimit = Math.round((marketPrice - capValue) * 100) / 100;
    const orderPrice = parseFloat(dto.Price.toString());

    if (orderPrice > upperLimit || orderPrice < lowerLimit) {
      throw new BadRequestException(
        `Price ${orderPrice} is Out of Range. Min : Nu. ${lowerLimit} Max : Nu. ${upperLimit}`,
      );
    }

    // Process order based on side
    let message: string;
    if (dto.OrderSide === 'B') {
      message = await this.processBuyOrder(dto, staticBrokerUsername);
    } else if (dto.OrderSide === 'S') {
      message = await this.processSellOrder(dto, staticBrokerUsername);
    } else {
      throw new BadRequestException('Something was wrong, Order Not Placed!');
    }

    return { message };
  }

  /**
   * Get broker username from username
   */
  private async getBrokerUserName(username: string): Promise<string> {
    const query = `
      SELECT broker_user_name
      FROM linkuser
      WHERE username = ?
      LIMIT 1
    `;
    const result = await this.cms22DataSource.query(query, [username]);
    return result.length > 0 ? result[0].broker_user_name : username;
  }

  /**
   * Get username from broker username (reverse lookup)
   */
  private async getUserNameFromBroker(brokerUserName: string): Promise<string> {
    const query = `
      SELECT username
      FROM linkuser
      WHERE broker_user_name = ?
      LIMIT 1
    `;
    const result = await this.cms22DataSource.query(query, [brokerUserName]);
    return result.length > 0 ? result[0].username : brokerUserName;
  }

  /**
   * Get previous amount from order using flag_id
   */
  private async getPreviousOrderAmount(flagId: number): Promise<number> {
    const query = `
      SELECT amount
      FROM bbo_finance
      WHERE flag_id = ?
      LIMIT 1
    `;
    const result = await this.cms22DataSource.query(query, [flagId]);
    if (result.length > 0) {
      // Return absolute value since buy orders have negative amounts
      return Math.abs(parseFloat(result[0].amount));
    }
    return 0;
  }

  /**
   * Check order size while updating (get existing order size)
   */
  private async getOrderSizeWhileUpdating(orderId: number): Promise<number> {
    const query = `
      SELECT order_size
      FROM orders
      WHERE order_id = ?
      LIMIT 1
    `;
    const result = await this.cms22DataSource.query(query, [orderId]);
    return result.length > 0 ? parseFloat(result[0].order_size) : 0;
  }

  /**
   * Check if order exists
   */
  private async checkOrderExists(orderId: number): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM orders
      WHERE order_id = ?
    `;
    const result = await this.cms22DataSource.query(query, [orderId]);
    return parseInt(result[0].count, 10);
  }

  /**
   * Get flag_id from order by order_id
   */
  private async getFlagIdFromOrder(orderId: number): Promise<string> {
    const query = `
      SELECT flag_id
      FROM orders
      WHERE order_id = ?
      LIMIT 1
    `;
    const result = await this.cms22DataSource.query(query, [orderId]);
    return result.length > 0 ? result[0].flag_id.toString() : '';
  }

  /**
   * Main method to update an existing order
   */
  async updateOrder(dto: UpdateOrderDto): Promise<OrderResponseDto> {
    // Static values
    const staticUpdateOrdersAPI = 'UpdateOrdersAPI';
    const staticBrokerUsername = 'MEMRSEBIT';

    // Log API request (include static values in log for reference)
    const logData = {
      ...dto,
      UpdateOrdersAPI: staticUpdateOrdersAPI,
      updateBrokerUsername: staticBrokerUsername,
    };
    const endpoint = JSON.stringify(logData);
    await this.logApiRequest(endpoint, dto.username);

    // Validate inputs are numeric
    if (isNaN(dto.updateVolume) || isNaN(dto.updatePrice)) {
      throw new BadRequestException(
        'Invalid Inputs, Volume and Price Should be Numeric.',
      );
    }

    const brokerUserName = staticBrokerUsername;
    const participantCode = dto.updateParticipantCode.trim();
    const orderId = dto.updateOrderId;
    const flagId = dto.updateFlagId;
    const existingVol = parseFloat(dto.existingVolume.toString());
    const newVolume = parseFloat(dto.updateVolume.toString());
    const newPrice = parseFloat(dto.updatePrice.toString().replace(/[^0-9.]/g, ''));
    const formattedPrice = parseFloat(newPrice.toFixed(2));
    const side = dto.updateSide.trim();
    const cdCode = dto.updateCdCode.trim().toUpperCase();
    const symbolId = dto.updateSymbolId;

    // Get username from broker username (for audit and other operations)
    const userName = await this.getUserNameFromBroker(brokerUserName);

    // Get commission and cash total
    const b_commis = await this.getClientCommissionTE(cdCode, brokerUserName);
    const tot = await this.getCashTotal(cdCode, brokerUserName);

    // Get pending volumes
    const [vol, pov, piv] = await this.getPendingVolumes(symbolId, cdCode);

    // Check if pov is negative
    if (pov < 0) {
      console.error(
        `Negative Issue. CD Code ==> ${cdCode}, symbol_id ==> ${symbolId}`,
      );
      throw new BadRequestException(
        'Order cannot be updated. Please contact RSEB support.',
      );
    }

    // Get existing order size from DB
    const ex_vol = await this.getOrderSizeWhileUpdating(orderId);

    // Check if order exists
    const orderExists = await this.checkOrderExists(orderId);
    if (orderExists === 0) {
      throw new BadRequestException(
        'It seems that this order was deleted already.',
      );
    }

    // Check market hours
    if (this.isMarketClosed()) {
      throw new BadRequestException('Market Is Closed.');
    }

    // Check price limits
    const marketPrice = await this.getMarketPrice(symbolId);
    const circuitBreaker = await this.getCircuitBreaker('CAP');
    const capValue = this.calculateCapValue(marketPrice, circuitBreaker);
    const upperLimit = Math.round((marketPrice + capValue) * 100) / 100;
    const lowerLimit = Math.round((marketPrice - capValue) * 100) / 100;

    if (formattedPrice > upperLimit || formattedPrice < lowerLimit) {
      throw new BadRequestException(
        `Price is Out of Range. Min : Nu. ${lowerLimit} Max : Nu. ${upperLimit}`,
      );
    }

    // Process update based on side
    let message: string;
    if (side === 'S') {
      message = await this.processUpdateSellOrder(
        orderId,
        flagId,
        cdCode,
        participantCode,
        userName,
        brokerUserName,
        symbolId,
        vol,
        pov,
        ex_vol,
        newVolume,
        formattedPrice,
        b_commis,
      );
    } else if (side === 'B') {
      message = await this.processUpdateBuyOrder(
        orderId,
        flagId,
        cdCode,
        participantCode,
        userName,
        brokerUserName,
        symbolId,
        tot,
        ex_vol,
        newVolume,
        formattedPrice,
        b_commis,
      );
    } else {
      throw new BadRequestException('Invalid order side');
    }

    return { message };
  }

  /**
   * Process Update Sell Order
   */
  private async processUpdateSellOrder(
    orderId: number,
    flagId: number,
    cdCode: string,
    participantCode: string,
    userName: string,
    brokerUserName: string,
    symbolId: number,
    vol: number,
    pov: number,
    ex_vol: number,
    newVolume: number,
    newPrice: number,
    commission: number,
  ): Promise<string> {
    // Calculate available volume change
    const avl_vol_change = vol + ex_vol;

    if (avl_vol_change < newVolume) {
      throw new BadRequestException('SellOrderErrorNoEnoughShares');
    }

    // Calculate new values
    const new_vol = avl_vol_change - newVolume;
    const new_pov = pov - ex_vol + newVolume;
    const new_commis_amt = (newVolume * newPrice * commission) / 100;
    const new_amt = newVolume * newPrice + new_commis_amt;

    // Start transaction
    const queryRunner = this.cms22DataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update CDS holdings
      const updateHoldingQuery = `
        UPDATE cds_holding 
        SET pending_out_vol = ?, volume = ?
        WHERE cd_code = ? AND symbol_id = ?
      `;
      await queryRunner.query(updateHoldingQuery, [
        new_pov,
        new_vol,
        cdCode,
        symbolId,
      ]);

      // Update bbo_finance
      const updateFinanceQuery = `
        UPDATE bbo_finance 
        SET amount = ?
        WHERE flag_id = ?
      `;
      await queryRunner.query(updateFinanceQuery, [new_amt, flagId]);

      // Get flag_id from orders table
      const flag_id = await this.getFlagIdFromOrder(orderId);
      const flagIdNum = parseInt(flag_id, 10) || 0;

      // Create audit entry
      await this.createOrderAudit(
        cdCode,
        participantCode,
        userName,
        newVolume,
        newVolume,
        symbolId,
        newPrice,
        'S',
        new_commis_amt,
        flag_id,
        brokerUserName,
      );

      // Update orders table
      const updateOrderQuery = `
        UPDATE orders 
        SET sell_vol = ?, order_size = ?, price = ?, commis_amt = ?
        WHERE order_id = ?
      `;
      await queryRunner.query(updateOrderQuery, [
        newVolume,
        newVolume,
        newPrice,
        new_commis_amt,
        orderId,
      ]);

      await queryRunner.commitTransaction();
      return 'Sell Order Was Updated Successfully.';
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error updating sell order');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Process Update Buy Order
   */
  private async processUpdateBuyOrder(
    orderId: number,
    flagId: number,
    cdCode: string,
    participantCode: string,
    userName: string,
    brokerUserName: string,
    symbolId: number,
    tot: number,
    ex_vol: number,
    newVolume: number,
    newPrice: number,
    commission: number,
  ): Promise<string> {
    // Get previous amount
    const e_amt = await this.getPreviousOrderAmount(flagId);

    // Calculate new values
    const new_commis_amt = (newVolume * newPrice * commission) / 100;
    const new_amt = newVolume * newPrice + new_commis_amt;
    const avl_amt = tot + e_amt;

    if (avl_amt < new_amt) {
      throw new BadRequestException('Sorry There Is Not Enough Cash.');
    }

    const new_amt_negative = new_amt * -1;

    // Start transaction
    const queryRunner = this.cms22DataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update bbo_finance
      const updateFinanceQuery = `
        UPDATE bbo_finance 
        SET amount = ?
        WHERE flag_id = ?
      `;
      await queryRunner.query(updateFinanceQuery, [new_amt_negative, flagId]);

      // Get flag_id from orders table
      const flag_id = await this.getFlagIdFromOrder(orderId);
      const flagIdNum = parseInt(flag_id, 10) || 0;

      // Create audit entry
      await this.createOrderAudit(
        cdCode,
        participantCode,
        userName,
        newVolume,
        newVolume,
        symbolId,
        newPrice,
        'B',
        new_commis_amt,
        flag_id,
        brokerUserName,
      );

      // Update orders table
      const updateOrderQuery = `
        UPDATE orders 
        SET buy_vol = ?, order_size = ?, price = ?, commis_amt = ?
        WHERE order_id = ?
      `;
      await queryRunner.query(updateOrderQuery, [
        newVolume,
        newVolume,
        newPrice,
        new_commis_amt,
        orderId,
      ]);

      // Update M-CaMS wallet if applicable (broker_user_name = 'MEMRNRB001')
      const mcams_user_id = 'MEMRNRB001';
      if (brokerUserName === mcams_user_id) {
        const updateMcamsQuery = `
          UPDATE mcams_wallet 
          SET amount = ?
          WHERE flag_id = ?
        `;
        await queryRunner.query(updateMcamsQuery, [
          new_amt_negative,
          flagId,
        ]);
      }

      await queryRunner.commitTransaction();
      return 'Buy Order Updated Successfully.';
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error updating buy order');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Main method to delete an order
   */
  async deleteOrder(dto: DeleteOrderDto): Promise<OrderResponseDto> {
    // Static value
    const staticDeleteOrderAPI = 'DeleteOrderAPI';

    // Log API request (include static value in log for reference)
    const logData = {
      ...dto,
      DeleteOrderAPI: staticDeleteOrderAPI,
    };
    const endpoint = JSON.stringify(logData);
    await this.logApiRequest(endpoint, dto.username);

    const orderId = dto.deleteOrder_id;
    const flagId = dto.deleteFid;
    const volume = parseFloat(dto.deleteV.toString());
    const side = dto.deleteSide.trim();
    const cdCode = dto.deleteCd_code.trim().toUpperCase();
    const symbolId = dto.deleteSy_id;

    // Check market hours
    if (this.isMarketClosed()) {
      throw new BadRequestException('Market Is Closed.');
    }

    // Verify order exists and get order details
    const orderCheckQuery = `
      SELECT order_id, side, cd_code, symbol_id, flag_id
      FROM orders
      WHERE order_id = ?
      LIMIT 1
    `;
    const orderCheck = await this.cms22DataSource.query(orderCheckQuery, [orderId]);

    if (orderCheck.length === 0) {
      // Additional check: verify if order exists with different case or similar
      const debugQuery = `
        SELECT order_id, side, cd_code, symbol_id, flag_id
        FROM orders
        WHERE order_id LIKE ? OR cd_code = ? OR symbol_id = ?
        LIMIT 5
      `;
      const debugResult = await this.cms22DataSource.query(debugQuery, [
        `%${orderId}%`,
        cdCode,
        symbolId,
      ]);
      
      let errorMessage = `Order with ID ${orderId} does not exist. It may have been already deleted.`;
      
      if (debugResult.length > 0) {
        errorMessage += ` Found ${debugResult.length} similar order(s) but none match the exact order_id.`;
      }
      
      throw new BadRequestException(errorMessage);
    }

    const existingOrder = orderCheck[0];

    // Verify order details match
    if (existingOrder.side !== side) {
      throw new BadRequestException(
        `Order side mismatch. Expected '${side}', but order has side '${existingOrder.side}'. Order ID: ${orderId}`,
      );
    }

    if (existingOrder.cd_code?.toUpperCase() !== cdCode.toUpperCase()) {
      throw new BadRequestException(
        `CD Code mismatch. Expected '${cdCode}', but order has CD code '${existingOrder.cd_code}'. Order ID: ${orderId}`,
      );
    }

    if (parseInt(existingOrder.symbol_id, 10) !== parseInt(symbolId.toString(), 10)) {
      throw new BadRequestException(
        `Symbol ID mismatch. Expected ${symbolId}, but order has symbol_id ${existingOrder.symbol_id}. Order ID: ${orderId}`,
      );
    }

    // Compare flag_id (handle both string and number types)
    const existingFlagId = existingOrder.flag_id;
    const flagIdStr = flagId.toString();
    const flagIdNum = typeof flagId === 'string' ? parseInt(flagId, 10) : flagId;
    const existingFlagIdStr = existingFlagId?.toString();
    const existingFlagIdNum = typeof existingFlagId === 'string' ? parseInt(existingFlagId, 10) : existingFlagId;
    
    if (
      existingFlagIdStr !== flagIdStr &&
      existingFlagIdNum !== flagIdNum &&
      existingFlagIdStr !== flagIdNum?.toString() &&
      existingFlagIdNum?.toString() !== flagIdStr
    ) {
      throw new BadRequestException(
        `Flag ID mismatch. Expected ${flagId}, but order has flag_id ${existingFlagId}. Order ID: ${orderId}`,
      );
    }

    // Start transaction
    const queryRunner = this.cms22DataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // For Sell Orders: Update CDS holdings
      if (side === 'S') {
        // Check pending_out_vol before updating
        const povCheckQuery = `
          SELECT pending_out_vol
          FROM cds_holding
          WHERE cd_code = ? AND symbol_id = ?
          LIMIT 1
        `;
        const povCheck = await queryRunner.query(povCheckQuery, [cdCode, symbolId]);

        if (povCheck.length === 0) {
          throw new BadRequestException(
            `CDS holding not found for CD Code ${cdCode} and Symbol ID ${symbolId}.`,
          );
        }

        const pendingOutVol = parseFloat(povCheck[0].pending_out_vol) || 0;
        const currentVolume = parseFloat(povCheck[0].volume) || 0;

        // Check if pending_out_vol is negative
        if (pendingOutVol < 0) {
          console.error(
            `Negative Issue. CD Code ==> ${cdCode}, symbol_id ==> ${symbolId}, pending_out_vol ==> ${pendingOutVol}`,
          );
          throw new BadRequestException(
            `Order cannot be cancelled. Data integrity issue detected: pending_out_vol is negative (${pendingOutVol}). Please contact RSEB support.`,
          );
        }

        // Check if POV is sufficient to cancel orders
        if (pendingOutVol - volume < 0) {
          console.error(
            `Insufficient shares to cancel in POV. CD Code: ${cdCode}, Symbol ID: ${symbolId}, pending_out_vol: ${pendingOutVol}, cancel_volume: ${volume}`,
          );
          throw new BadRequestException(
            `Order cannot be cancelled. Insufficient pending shares. Available: ${pendingOutVol}, Required: ${volume}. Please contact RSEB support.`,
          );
        }

        // Update CDS holdings: decrease pending_out_vol, increase volume
        const updateHoldingQuery = `
          UPDATE cds_holding 
          SET pending_out_vol = pending_out_vol - ?, volume = volume + ?
          WHERE cd_code = ? AND symbol_id = ?
        `;
        const updateResult = await queryRunner.query(updateHoldingQuery, [
          volume,
          volume,
          cdCode,
          symbolId,
        ]);

        if (!updateResult || updateResult.affectedRows === 0) {
          throw new BadRequestException(
            `Failed to update CDS holdings for CD Code ${cdCode} and Symbol ID ${symbolId}.`,
          );
        }
      }
      // For Buy Orders: No CDS holding update needed

      // Get max order_date from orders_audit for this flag_id
      const maxOrderDateQuery = `
        SELECT MAX(order_date) as od
        FROM orders_audit
        WHERE flag_id = ?
      `;
      const maxOrderDateResult = await queryRunner.query(maxOrderDateQuery, [
        flagId,
      ]);
      const orderDate =
        maxOrderDateResult.length > 0 && maxOrderDateResult[0].od
          ? maxOrderDateResult[0].od
          : null;

      if (!orderDate) {
        throw new BadRequestException(
          `Cannot find audit entry for flag_id ${flagId}. Order audit record may be missing.`,
        );
      }

      // Update orders_audit: Set flag='C' and username=cd_code
      const updateAuditQuery = `
        UPDATE orders_audit 
        SET flag = 'C', username = ?
        WHERE flag_id = ? AND order_date = ?
      `;
      const auditUpdateResult = await queryRunner.query(updateAuditQuery, [
        cdCode,
        flagId,
        orderDate,
      ]);

      if (!auditUpdateResult || auditUpdateResult.affectedRows === 0) {
        throw new BadRequestException(
          `Failed to update audit entry. flag_id: ${flagId}, order_date: ${orderDate}. No matching audit record found.`,
        );
      }

      // Delete from orders table
      const deleteOrderQuery = `
        DELETE FROM orders
        WHERE order_id = ?
      `;
      const deleteOrderResult = await queryRunner.query(deleteOrderQuery, [
        orderId,
      ]);

      if (!deleteOrderResult || deleteOrderResult.affectedRows === 0) {
        throw new BadRequestException(
          `Failed to delete order with ID ${orderId}. Order may have been already deleted or does not exist.`,
        );
      }

      // Delete from bbo_finance
      const deleteFinanceQuery = `
        DELETE FROM bbo_finance
        WHERE flag_id = ?
      `;
      const deleteFinanceResult = await queryRunner.query(deleteFinanceQuery, [
        flagId,
      ]);

      if (!deleteFinanceResult || deleteFinanceResult.affectedRows === 0) {
        throw new BadRequestException(
          `Order was deleted successfully, but failed to delete finance record with flag_id ${flagId}. Finance record may not exist.`,
        );
      }

      // Delete from mcams_wallet (if exists)
      const deleteMcamsQuery = `
        DELETE FROM mcams_wallet
        WHERE flag_id = ?
      `;
      await queryRunner.query(deleteMcamsQuery, [flagId]);
      // Note: This may not affect any rows if entry doesn't exist, which is fine

      await queryRunner.commitTransaction();
      return { message: 'Order Deleted Successfully.' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error deleting order');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get pending orders for a username
   */
  async getPendingOrders(username: string): Promise<PendingOrdersResponseDto> {
    if (!username || !username.trim()) {
      throw new BadRequestException('Username is required');
    }

    const query = `
      SELECT 
        a.cd_code,
        a.participant_code,
        a.member_broker,
        a.side,
        a.order_date,
        CAST(a.buy_vol AS CHAR) AS buy_vol,
        CAST(a.sell_vol AS CHAR) AS sell_vol,
        CAST(a.order_size AS CHAR) AS order_size,
        CAST(a.order_id AS CHAR) AS order_id,
        CAST(a.symbol_id AS CHAR) AS symbol_id,
        CAST(a.price AS CHAR) AS price,
        CAST(a.commis_amt AS CHAR) AS commis_amt,
        CAST(a.flag_id AS CHAR) AS flag_id,
        b.symbol
      FROM orders a
      INNER JOIN symbol b ON a.symbol_id = b.symbol_id
      WHERE a.order_entry = ?
      ORDER BY a.side DESC
    `;

    try {
      const results = await this.cms22DataSource.query(query, [username.trim()]);
      
      const orders: PendingOrderItemDto[] = results.map((row: any) => ({
        cd_code: row.cd_code || '',
        participant_code: row.participant_code || '',
        member_broker: row.member_broker || '',
        side: row.side || '',
        order_date: row.order_date ? new Date(row.order_date).toISOString().replace('T', ' ').substring(0, 19) : '',
        buy_vol: row.buy_vol || null,
        sell_vol: row.sell_vol || null,
        order_size: row.order_size || '0',
        order_id: row.order_id || '',
        symbol_id: row.symbol_id || '',
        price: row.price || '0.00',
        commis_amt: row.commis_amt || '0.00',
        flag_id: row.flag_id || '',
        symbol: row.symbol || '',
      }));

      return {
        success: true,
        data: orders,
        count: orders.length,
      };
    } catch (error) {
      console.error('Error fetching pending orders:', error);
      throw new BadRequestException('Failed to fetch pending orders');
    }
  }
}
