import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('emd')
export class Emd {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cid: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  cd_code: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  app_fee: number;

  @Column({ type: 'tinyint', default: 0 })
  fee_status: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  order_no: string;

  @Column({ type: 'int', nullable: true })
  user_online_id: number;
}
