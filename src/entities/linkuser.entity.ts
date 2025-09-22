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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

