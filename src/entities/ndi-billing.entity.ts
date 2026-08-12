import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('ndi_billing')
export class NdiBilling {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cid', type: 'varchar', length: 11 })
  cid: string;

  @Column({ name: 'cd_code', type: 'varchar', length: 15 })
  cd_code: string;

  @Column({ name: 'thread_id', type: 'varchar', length: 50 })
  thread_id: string;

  @Column({ name: 'order_no', type: 'varchar', length: 50 })
  order_no: string;

  @Column({ name: 'service_type', type: 'varchar', length: 25 })
  service_type: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
