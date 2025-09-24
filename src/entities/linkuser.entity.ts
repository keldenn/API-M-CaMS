import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('linkuser')
export class LinkUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  client_code: string;

  @Column()
  participant_code: string;

  @Column()
  username: string;

  @Column()
  broker_user_name: string;

  @Column({ type: 'datetime', nullable: true })
  created_at: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at: Date;
}

