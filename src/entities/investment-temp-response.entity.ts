import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('investment_temp_response')
export class InvestmentTempResponse {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  order_number: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  investment_amount: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  auth_code: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  msg_type: string;
}
