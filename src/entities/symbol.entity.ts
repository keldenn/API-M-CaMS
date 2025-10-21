import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('symbol')
export class Symbol {
  @PrimaryGeneratedColumn({ name: 'symbol_id' })
  symbol_id: number;

  @Column()
  symbol: string;

  @Column()
  name: string;

  @Column()
  status: number;

  @Column({ name: 'security_type' })
  security_type: string;

  @Column()
  trsstatus: number;

  @Column({ name: 'paid_up_shares', type: 'decimal', precision: 18, scale: 2 })
  paid_up_shares: number;
}
