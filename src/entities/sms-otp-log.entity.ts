import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('sms_otp_logs')
export class SmsOtpLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', nullable: true })
  phone_no: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email: string;

  @Column({ type: 'int', nullable: true })
  otp_no: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  message: string;

  @Column({ type: 'int', default: 0 })
  status: number;

  @CreateDateColumn({ type: 'datetime' })
  created_date: Date;
}
