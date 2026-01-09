import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Symbol } from './symbol.entity';

@Entity('market_price_history')
export class MarketPriceHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'symbol_id' })
  symbol_id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0.0 })
  price: number;

  @Column({ type: 'datetime' })
  date: Date;

  @ManyToOne(() => Symbol)
  @JoinColumn({ name: 'symbol_id' })
  symbol: Symbol;
}
