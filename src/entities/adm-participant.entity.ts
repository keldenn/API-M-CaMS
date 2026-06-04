import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('adm_participants')
export class AdmParticipant {
  @PrimaryGeneratedColumn({
    name: 'participant_id',
    type: 'bigint',
    unsigned: true,
  })
  participant_id: number;

  @Column({ name: 'participant_type', type: 'varchar', length: 16, nullable: true })
  participant_type: string | null;

  @Column({
    name: 'participant_code',
    type: 'varchar',
    length: 16,
    nullable: true,
    unique: true,
  })
  participant_code: string | null;

  @Column({ name: 'contact_person', type: 'varchar', length: 50 })
  contact_person: string;

  @Column({ name: 'address', type: 'varchar', length: 100 })
  address: string;

  @Column({ name: 'clearing_account', type: 'varchar', length: 100 })
  clearing_account: string;

  @Column({ name: 'institution_id', type: 'bigint' })
  institution_id: number;

  @Column({ name: 'phone', type: 'bigint' })
  phone: number;

  @Column({ name: 'email', type: 'varchar', length: 50 })
  email: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at: Date;

  @Column({ name: 'name', type: 'varchar', length: 200, default: '' })
  name: string;

  @Column({ name: 'status', type: 'int', default: 0 })
  status: number;
}
