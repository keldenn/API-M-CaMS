import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('mobile_api_log')
export class MobileApiLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'datetime' })
  date: Date;

  @Column({ type: 'text' })
  endpoint: string;

  @Column()
  user: string;

  @CreateDateColumn()
  created_at: Date;
}

