import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('api_online_terminal')
export class ApiOnlineTerminal {
  @PrimaryGeneratedColumn({ name: 'user_online_id', type: 'bigint', unsigned: true })
  user_online_id: number;

  @Column({ type: 'char', length: 11 })
  cid: string;

  @Column({ type: 'varchar', length: 10 })
  cd_code: string;

  @Column({ type: 'varchar', length: 10 })
  participant_code: string;

  @Column({ type: 'varchar', length: 225 })
  name: string;

  @Column({ type: 'bigint', nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 225 })
  email: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  address: string;

  @Column({ type: 'int', default: 0 })
  declaration: number;

  @Column({ type: 'varchar', length: 225 })
  broker_user: string;

  @Column({ type: 'varchar', length: 100 })
  status: string;

  @Column({ type: 'int' })
  app_fee: number;

  @Column({ type: 'char', length: 3, default: '0' })
  fee_status: string;

  @Column({ type: 'varchar', length: 255 })
  order_no: string;

  @CreateDateColumn({ name: 'created_date', type: 'timestamp' })
  created_date: Date;

  @Column({ type: 'varchar', length: 50, default: '0' })
  bank_acc_number: string;
}
