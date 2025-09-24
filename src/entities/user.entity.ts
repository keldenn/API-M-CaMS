import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({ default: true })
  is_bcrypt: boolean;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  cid: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  profilePicture: string;

  @Column({ default: 1 })
  status: number;

  @Column()
  role_id: number;

  @Column({ default: 0 })
  isNRB: number;

  @Column({ type: 'datetime', nullable: true })
  created_at: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at: Date;
}

