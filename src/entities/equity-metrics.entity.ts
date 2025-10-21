import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('equity_metrics')
export class EquityMetrics {
  @PrimaryGeneratedColumn({ name: 'equity_metrics_id' })
  equity_metrics_id: number;

  @Column()
  script: string;

  @Column()
  year: number;

  @Column({ name: 'dividend_yield', type: 'decimal', precision: 18, scale: 4 })
  dividend_yield: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  beta: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  eps: number;

  @Column({ name: 'pe_ratio', type: 'decimal', precision: 18, scale: 4 })
  pe_ratio: number;
}
