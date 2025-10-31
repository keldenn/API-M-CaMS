import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('corporate_actions')
export class CorporateActions {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'corporate_action' })
  corporate_action: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'varchar', length: 10 })
  year: string;

  @Column()
  script: string;

  @Column({ name: 'employee_id', type: 'bigint' })
  employee_id: number;

  @Column()
  status: number;

  @Column({ name: 'created_at', type: 'datetime' })
  created_at: Date;

  @Column({ name: 'updated_at', type: 'datetime' })
  updated_at: Date;
}

