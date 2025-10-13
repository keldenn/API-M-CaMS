import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('symbol')
export class Symbol {
  @PrimaryGeneratedColumn({ name: 'symbol_id' })
  symbol_id: number;

  @Column()
  symbol: string;

  @Column()
  status: number;
}
