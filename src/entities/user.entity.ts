import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  username: string;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  temp_password: string;

  @Column({ default: 0 })
  is_bcrypt: number;

  @Column({ nullable: true })
  participant_code: string;

  @Column({ nullable: true })
  cid: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  phone: number;

  @Column()
  role_id: number;

  @Column()
  status: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ nullable: true })
  log_check: number;

  @Column({ nullable: true })
  cd_code: string;

  @Column({ default: 0 })
  amount: number;

  @Column({ default: 0 })
  amt_status: number;

  @Column({ nullable: true })
  orderNo: string;

  @Column({ default: 0 })
  renew_user_flag: number;

  @Column({ default: 'no' })
  profilePicture: string;

  @Column({ default: 0 })
  as_message_check: number;

  @Column({ type: 'enum', enum: ['Y', 'N'], default: 'N' })
  isNRB: string;

  @Column({ nullable: true })
  isPin: number;
}

