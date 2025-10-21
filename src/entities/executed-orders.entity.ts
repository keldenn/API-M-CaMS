import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Symbol } from './symbol.entity';

@Entity('executed_orders')
export class ExecutedOrders {
  @PrimaryGeneratedColumn({ name: 'executed_order_id' })
  executed_order_id: number;

  @Column({ name: 'symbol_id' })
  symbol_id: number;

  @Column({ name: 'order_exe_price', type: 'decimal', precision: 18, scale: 4 })
  order_exe_price: number;

  @Column({ name: 'lot_size_execute', type: 'decimal', precision: 18, scale: 2 })
  lot_size_execute: number;

  @Column({ name: 'order_date', type: 'datetime' })
  order_date: Date;

  @Column()
  side: string;

  @ManyToOne(() => Symbol)
  @JoinColumn({ name: 'symbol_id' })
  symbol: Symbol;
}
