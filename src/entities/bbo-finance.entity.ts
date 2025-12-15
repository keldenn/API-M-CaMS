import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bbo_finance')
export class BboFinance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cd_code' })
  cd_code: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  amount: number;

  @Column({ name: 'user_name', nullable: true })
  user_name: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column()
  flag: number;

  @Column({ name: 'institution_id', nullable: true })
  institution_id: number;

  @Column({ name: 'flag_id', nullable: true })
  flag_id: string;

  @Column({ default: 0 })
  status: number;
}
