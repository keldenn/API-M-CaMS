import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersWatchlist } from '../entities/users-watchlist.entity';
import { MarketPrice } from '../entities/market-price.entity';
import { WatchlistController } from './watchlist.controller';
import { WatchlistService } from './watchlist.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsersWatchlist], 'cms22'),
    TypeOrmModule.forFeature([MarketPrice]),
  ],
  controllers: [WatchlistController],
  providers: [WatchlistService],
  exports: [WatchlistService],
})
export class WatchlistModule {}
