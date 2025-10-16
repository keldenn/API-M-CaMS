import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('market_index')
export class MarketIndex {
  @PrimaryGeneratedColumn({ name: 'market_index_id' })
  market_index_id: number;

  @Column({ name: 'm_index', type: 'decimal', precision: 18, scale: 4 })
  m_index: number;

  @Column({ type: 'datetime', name: 'created_date' })
  created_date: Date;
}
