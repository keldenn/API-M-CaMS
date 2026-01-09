import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Symbol } from './symbol.entity';

@Entity('executed_orders')
export class ExecutedOrders {
  @PrimaryGeneratedColumn({ name: 'exe_id' })
  exe_id: number;

  @Column({ name: 'symbol_id', type: 'bigint', nullable: true })
  symbol_id: number;

  @Column({ name: 'order_exe_price', type: 'decimal', precision: 13, scale: 2, nullable: true })
  order_exe_price: number;

  @Column({
    name: 'lot_size_execute',
    type: 'bigint',
    nullable: true,
  })
  lot_size_execute: number;

  @Column({ name: 'order_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  order_date: Date;

  @Column({ type: 'char', length: 1, nullable: true })
  side: string;

  @ManyToOne(() => Symbol)
  @JoinColumn({ name: 'symbol_id' })
  symbol: Symbol;
}
