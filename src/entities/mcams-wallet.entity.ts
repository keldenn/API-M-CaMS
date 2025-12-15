import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('mcams_wallet')
export class McamsWallet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cd_code' })
  cd_code: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column()
  type: string;

  @Column({ name: 'paid_to_user' })
  paid_to_user: string;

  @Column({ name: 'trx_time', type: 'datetime' })
  trx_time: Date;

  @Column({ name: 'flag_id' })
  flag_id: string;
}
