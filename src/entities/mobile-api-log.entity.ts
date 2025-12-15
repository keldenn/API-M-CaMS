import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

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
}
