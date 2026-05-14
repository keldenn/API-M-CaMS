import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersWatchlist } from '../entities/users-watchlist.entity';
import { MarketPrice } from '../entities/market-price.entity';
import { WatchlistMutationDto } from './dto/watchlist-mutation.dto';
import { WatchlistResponseDto } from './dto/watchlist-response.dto';
import { WatchlistItemWithPriceDto } from './dto/watchlist-item-with-price.dto';

type PriceRow = {
  symbol: string;
  name: string;
  currentPrice: string | number;
  priceChange: string | number;
  exMarketPrice: string | number;
};

@Injectable()
export class WatchlistService {
  constructor(
    @InjectRepository(UsersWatchlist, 'cms22')
    private readonly watchlistRepository: Repository<UsersWatchlist>,
    @InjectRepository(MarketPrice)
    private readonly marketPriceRepository: Repository<MarketPrice>,
  ) {}

  async add(dto: WatchlistMutationDto): Promise<WatchlistResponseDto> {
    const cd_code = dto.cd_code.trim();
    const symbol = dto.symbol.trim();

    const existing = await this.watchlistRepository.findOne({
      where: { cd_code, symbol },
    });
    if (existing) {
      return {
        success: true,
        message: 'Symbol is already on the watchlist.',
        id: existing.id,
      };
    }

    const row = this.watchlistRepository.create({ cd_code, symbol });
    const saved = await this.watchlistRepository.save(row);
    return {
      success: true,
      message: 'Symbol added to watchlist.',
      id: saved.id,
    };
  }

  async remove(dto: WatchlistMutationDto): Promise<WatchlistResponseDto> {
    const cd_code = dto.cd_code.trim();
    const symbol = dto.symbol.trim();

    const result = await this.watchlistRepository.delete({ cd_code, symbol });
    if (!result.affected) {
      throw new NotFoundException(
        'No watchlist entry found for this cd_code and symbol.',
      );
    }
    return { success: true, message: 'Symbol removed from watchlist.' };
  }

  /**
   * Distinct (cd_code, symbol) for rows whose symbol matches a changed price
   * (case-insensitive on symbol so FCM still fires if casing differs).
   */
  async findWatchersForSymbols(
    symbols: string[],
  ): Promise<Array<{ cd_code: string; symbol: string }>> {
    const normalized = [
      ...new Set(
        symbols
          .map((s) => s.trim().toUpperCase())
          .filter((s) => s.length > 0),
      ),
    ];
    if (!normalized.length) {
      return [];
    }

    const rows = await this.watchlistRepository
      .createQueryBuilder('w')
      .select(['w.cd_code', 'w.symbol'])
      .where('UPPER(TRIM(w.symbol)) IN (:...sym)', { sym: normalized })
      .getMany();

    const seen = new Set<string>();
    const out: Array<{ cd_code: string; symbol: string }> = [];
    for (const r of rows) {
      const sym = r.symbol.trim().toUpperCase();
      const key = `${r.cd_code}|${sym}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ cd_code: r.cd_code, symbol: sym });
    }
    return out;
  }

  /**
   * Watchlist rows for the client, enriched with the same price query as
   * GET /stocks/price (market_price join symbol, OS / active / trsstatus filters).
   */
  async getWatchlistWithPrices(
    cd_code: string,
  ): Promise<WatchlistItemWithPriceDto[]> {
    const cd = cd_code?.trim() ?? '';
    if (!cd) {
      return [];
    }

    const watchRows = await this.watchlistRepository.find({
      where: { cd_code: cd },
      order: { created_At: 'ASC' },
    });
    if (!watchRows.length) {
      return [];
    }

    const distinctKeys = [
      ...new Set(
        watchRows.map((w) => w.symbol.trim().toUpperCase()).filter(Boolean),
      ),
    ];
    if (!distinctKeys.length) {
      return [];
    }

    const placeholders = distinctKeys.map(() => '?').join(', ');
    const priceQuery = `
      SELECT
        symbol.symbol AS symbol,
        symbol.name AS name,
        market_price.market_price AS currentPrice,
        market_price.market_price - market_price.ex_market_price AS priceChange,
        market_price.ex_market_price AS exMarketPrice
      FROM market_price
      JOIN symbol ON market_price.symbol_id = symbol.symbol_id
      WHERE symbol.security_type = 'OS'
        AND symbol.status = 1
        AND symbol.trsstatus IN (1, 3)
        AND UPPER(TRIM(symbol.symbol)) IN (${placeholders})
    `;

    const priceResults: PriceRow[] =
      await this.marketPriceRepository.query(priceQuery, distinctKeys);

    const priceBySymbol = new Map<string, PriceRow>();
    for (const pr of priceResults) {
      const key = String(pr.symbol).trim().toUpperCase();
      priceBySymbol.set(key, pr);
    }

    const out: WatchlistItemWithPriceDto[] = [];
    for (const w of watchRows) {
      const key = w.symbol.trim().toUpperCase();
      const pr = priceBySymbol.get(key);
      const price = pr ? parseFloat(String(pr.currentPrice)) : 0;
      const change = pr ? parseFloat(String(pr.priceChange)) : 0;
      const ex = pr ? parseFloat(String(pr.exMarketPrice)) : 0;
      const changePercent =
        Number.isFinite(ex) && ex !== 0
          ? Math.round((change / ex) * 10000) / 100
          : 0;

      out.push({
        symbol: w.symbol.trim(),
        name: pr?.name?.trim() || w.symbol.trim(),
        price: Number.isFinite(price) ? Math.round(price * 100) / 100 : 0,
        change: Number.isFinite(change) ? Math.round(change * 100) / 100 : 0,
        changePercent,
        addedAt: new Date(w.created_At).toISOString(),
      });
    }

    return out;
  }
}
