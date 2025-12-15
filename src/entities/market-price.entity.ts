import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Symbol } from './symbol.entity';

@Entity('market_price')
export class MarketPrice {
  @PrimaryGeneratedColumn({ name: 'market_price_id' })
  market_price_id: number;

  @Column({ name: 'symbol_id' })
  symbol_id: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  market_price: number;

  @Column({ name: 'ex_market_price', type: 'decimal', precision: 18, scale: 4 })
  ex_market_price: number;

  @Column({ type: 'datetime' })
  date: Date;

  @ManyToOne(() => Symbol)
  @JoinColumn({ name: 'symbol_id' })
  symbol: Symbol;
}
