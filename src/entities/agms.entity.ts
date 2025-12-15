import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('agms')
export class Agms {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'agm_name' })
  agm_name: string;

  @Column()
  venue: string;

  @Column({ type: 'datetime' })
  date: string;

  @Column({ name: 'created_at', type: 'datetime' })
  created_at: string;

  @Column()
  script: string;

  @Column()
  status: number;
}
