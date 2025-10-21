import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('scripts')
export class Scripts {
  @PrimaryGeneratedColumn({ name: 'script_id' })
  script_id: number;

  @Column()
  symbol: string;

  @Column()
  name: string;
}
