import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sector_index')
export class SectorIndex {
  @PrimaryGeneratedColumn({ name: 'sector_index_id' })
  sector_index_id: number;

  @Column({ name: 'sector_type' })
  sector_type: string;

  @Column({ name: 's_index', type: 'decimal', precision: 18, scale: 4 })
  s_index: number;

  @Column({ type: 'datetime', name: 'created_date' })
  created_date: Date;
}
