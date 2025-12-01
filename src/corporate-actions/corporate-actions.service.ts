import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CorporateActions } from '../entities/corporate-actions.entity';
import { Agms } from '../entities/agms.entity';
import { CorporateActionsResponseDto } from './dto/corporate-actions-response.dto';
import { AgmResponseDto } from './dto/agm-response.dto';
import { SingleScriptResponseDto } from './dto/single-script-response.dto';
import { ListedScriptsResponseDto } from './dto/listed-scripts-response.dto';
import { Scripts } from '../entities/scripts.entity';
import { Symbol } from '../entities/symbol.entity';

@Injectable()
export class CorporateActionsService {
  constructor(
    @InjectRepository(CorporateActions, 'financial')
    private corporateActionsRepository: Repository<CorporateActions>,
    @InjectRepository(Agms, 'financial')
    private agmsRepository: Repository<Agms>,
    @InjectRepository(Scripts, 'financial')
    private scriptsRepository: Repository<Scripts>,
    @InjectRepository(Symbol, 'default')
    private symbolRepository: Repository<Symbol>,
  ) {}

  async getCorporateActionsByScript(script: string): Promise<CorporateActionsResponseDto[]> {
    if (!script || script.trim() === '') {
      throw new BadRequestException('Script parameter is required');
    }

    // Execute raw SQL query as provided by the user
    const query = `
      SELECT * 
      FROM corporate_actions 
      WHERE script = ?
      ORDER BY year DESC
    `;

    try {
      const results = await this.corporateActionsRepository.query(query, [script]);

      if (!results || results.length === 0) {
        throw new NotFoundException(`No corporate actions found for script: ${script}`);
      }

       // Map the results to DTO format
       return results.map((row: any) => ({
         corporate_action: row.corporate_action,
         amount: row.amount?.toString() || row.amount,
         remarks: row.remarks || '',
         year: row.year?.toString() || row.year,
       }));
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      console.error('Error fetching corporate actions:', error);
      throw new NotFoundException(`Failed to fetch corporate actions for script: ${script}`);
    }
  }

  async getAgmByScript(script: string): Promise<AgmResponseDto[]> {
    if (!script || script.trim() === '') {
      throw new BadRequestException('Script parameter is required');
    }

    // Execute raw SQL query as provided by the user
    const query = `
      SELECT 
        agms.agm_name,
        agms.venue,
        agms.date,
        agms.created_at,
        scripts.name
      FROM agms
      INNER JOIN scripts 
        ON agms.script = scripts.symbol
      WHERE agms.status = 1
        AND agms.script = ?
      ORDER BY agms.created_at DESC
    `;

    try {
      const results = await this.agmsRepository.query(query, [script]);

      if (!results || results.length === 0) {
        throw new NotFoundException(`No AGM data found for script: ${script}`);
      }

      // Map the results to DTO format
      return results.map((row: any) => ({
        agm_name: row.agm_name,
        venue: row.venue,
        date: row.date,
        created_at: row.created_at,
      }));
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      console.error('Error fetching AGM data:', error);
      throw new NotFoundException(`Failed to fetch AGM data for script: ${script}`);
    }
  }

  async getSingleScriptBySymbol(script: string): Promise<SingleScriptResponseDto[]> {
    if (!script || script.trim() === '') {
      throw new BadRequestException('Script parameter is required');
    }

    const query = `
      SELECT 
        sector,
        paid_up_shares,
        address,
        date_of_est,
        website_link
      FROM scripts
      WHERE symbol = ?
    `;

    try {
      const results = await this.scriptsRepository.query(query, [script]);

      if (!results || results.length === 0) {
        throw new NotFoundException(`No script found for symbol: ${script}`);
      }

      return results.map((row: any) => ({
        sector: row.sector,
        paid_up_shares: row.paid_up_shares?.toString() || row.paid_up_shares,
        address: row.address,
        date_of_est: row.date_of_est?.toString() || row.date_of_est,
        website_link: row.website_link,
      }));
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error fetching single script:', error);
      throw new NotFoundException(`Failed to fetch script for symbol: ${script}`);
    }
  }

  async fetchListedScripts(): Promise<ListedScriptsResponseDto[]> {
    // Execute raw SQL query as provided by the user
    const query = `
      SELECT * 
      FROM symbol s 
      WHERE s.\`status\` = 1 
        AND s.security_type = "OS"
    `;

    try {
      const results = await this.symbolRepository.query(query);

      if (!results || results.length === 0) {
        return [];
      }

      // Map the results to DTO format
      return results.map((row: any) => ({
        symbol_id: row.symbol_id?.toString() || row.symbol_id,
        symbol: row.symbol,
        name: row.name,
      }));
    } catch (error) {
      console.error('Error fetching listed scripts:', error);
      throw new NotFoundException('Failed to fetch listed scripts');
    }
  }
}

