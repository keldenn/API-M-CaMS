import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('login_attempts')
export class LoginAttempt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  @Column({ type: 'datetime' })
  date: Date;
}

