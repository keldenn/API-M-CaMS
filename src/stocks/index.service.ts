import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketIndex } from '../entities/market-index.entity';
import { SectorIndex } from '../entities/sector-index.entity';
import { IndexDataDto } from './dto/index-data.dto';
import { IndexGateway } from './index.gateway';

@Injectable()
export class IndexService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndexService.name);
  private indexCheckInterval: NodeJS.Timeout;
  private lastIndexData: Map<string, number> = new Map();
  private readonly CHECK_INTERVAL = 24 * 60 * 60 * 1000; // Check every 24 hours

  constructor(
    @InjectRepository(MarketIndex)
    private readonly marketIndexRepository: Repository<MarketIndex>,
    @InjectRepository(SectorIndex)
    private readonly sectorIndexRepository: Repository<SectorIndex>,
    @Inject(forwardRef(() => IndexGateway))
    private indexGateway: IndexGateway,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing index service...');
    // Initialize last index data
    const indexData = await this.getAllIndexData();
    indexData.forEach((index) => {
      this.lastIndexData.set(index.sector_type, index.current_index);
    });

    // Start monitoring index changes
    this.startIndexMonitoring();
  }

  onModuleDestroy() {
    if (this.indexCheckInterval) {
      clearInterval(this.indexCheckInterval);
    }
  }

  async getAllIndexData(): Promise<IndexDataDto[]> {
    const query = `
      WITH 
      -- Get top 2 BSI records
      bsi_ranked AS (
          SELECT 
              m_index,
              ROW_NUMBER() OVER (ORDER BY created_date DESC) AS rn
          FROM market_index
      ),
      -- Get top 2 records per sector
      sector_ranked AS (
          SELECT 
              sector_type,
              s_index,
              ROW_NUMBER() OVER (PARTITION BY sector_type ORDER BY created_date DESC) AS rn
          FROM sector_index
      ),
      -- Calculate BSI change
      bsi_result AS (
          SELECT 
              'BSI' AS sector_type,
              t1.m_index AS current_index,
              ROUND((t1.m_index - t2.m_index), 2) AS ptChange
          FROM bsi_ranked t1
          JOIN bsi_ranked t2 ON t2.rn = 2
          WHERE t1.rn = 1
      ),
      -- Calculate sector performance
      sector_result AS (
          SELECT 
              t1.sector_type,
              t1.s_index AS current_index,
              ROUND((t1.s_index - t2.s_index), 2) AS ptChange
          FROM sector_ranked t1
          JOIN sector_ranked t2 
              ON t1.sector_type = t2.sector_type
             AND t2.rn = 2
          WHERE t1.rn = 1
      )
      -- Combine both results
      SELECT 
          sector_type,
          current_index,
          ptChange
      FROM bsi_result

      UNION ALL

      SELECT 
          sector_type,
          current_index,
          ptChange
      FROM sector_result
    `;

    const results = await this.marketIndexRepository.query(query);

    return results.map((row) => ({
      sector_type: row.sector_type,
      current_index: parseFloat(row.current_index),
      ptChange: parseFloat(row.ptChange),
    }));
  }

  private startIndexMonitoring() {
    this.indexCheckInterval = setInterval(async () => {
      try {
        const currentIndexData = await this.getAllIndexData();
        const changedIndexData = this.detectIndexChanges(currentIndexData);

        if (changedIndexData.length > 0) {
          this.logger.log(
            `Index changes detected for ${changedIndexData.length} sectors`,
          );
          // Broadcast all index data (or just changed ones, depending on your needs)
          this.indexGateway.broadcastIndexUpdate(currentIndexData);

          // Update last known index data
          currentIndexData.forEach((index) => {
            this.lastIndexData.set(index.sector_type, index.current_index);
          });
        }
      } catch (error) {
        this.logger.error('Error checking index changes:', error);
      }
    }, this.CHECK_INTERVAL);

    this.logger.log(
      `Started index monitoring (interval: ${this.CHECK_INTERVAL}ms)`,
    );
  }

  private detectIndexChanges(currentIndexData: IndexDataDto[]): IndexDataDto[] {
    const changedIndexData: IndexDataDto[] = [];

    for (const index of currentIndexData) {
      const lastIndex = this.lastIndexData.get(index.sector_type);
      if (lastIndex === undefined || lastIndex !== index.current_index) {
        changedIndexData.push(index);
      }
    }

    return changedIndexData;
  }
}
