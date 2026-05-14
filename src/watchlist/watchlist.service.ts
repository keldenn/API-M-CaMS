import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersWatchlist } from '../entities/users-watchlist.entity';
import { WatchlistMutationDto } from './dto/watchlist-mutation.dto';
import { WatchlistResponseDto } from './dto/watchlist-response.dto';

@Injectable()
export class WatchlistService {
  constructor(
    @InjectRepository(UsersWatchlist, 'cms22')
    private readonly watchlistRepository: Repository<UsersWatchlist>,
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
}
