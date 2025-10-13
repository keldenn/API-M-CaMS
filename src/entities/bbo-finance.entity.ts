import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bbo_finance')
export class BboFinance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cd_code' })
  cd_code: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  amount: number;

  @Column()
  status: number;

  @Column()
  flag: number;
}
