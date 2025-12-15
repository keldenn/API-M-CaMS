import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cds_holding')
export class CdsHolding {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'symbol_id' })
  symbol_id: number;

  @Column({ name: 'cd_code' })
  cd_code: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  volume: number;

  @Column({
    name: 'pending_out_vol',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  pending_out_vol: number;

  @Column({
    name: 'pending_in_vol',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  pending_in_vol: number;

  @Column({
    name: 'pledge_volume',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  pledge_volume: number;

  @Column({
    name: 'block_volume',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  block_volume: number;
}
