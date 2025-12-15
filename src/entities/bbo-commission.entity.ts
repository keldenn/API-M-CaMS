import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bbo_commission')
export class BboCommission {
  @PrimaryGeneratedColumn({ name: 'bro_comm_id' })
  bro_comm_id: number;

  @Column({ name: 'institution_id', type: 'int', nullable: true })
  institution_id: number | null;

  @Column({
    name: 'rate',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  rate: number | null;
}
