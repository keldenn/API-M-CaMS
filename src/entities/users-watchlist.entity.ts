import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('users_watchlist')
export class UsersWatchlist {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cd_code', type: 'varchar', length: 50 })
  cd_code: string;

  @Column({ type: 'varchar', length: 10 })
  symbol: string;

  @CreateDateColumn({ name: 'created_At', type: 'timestamp' })
  created_At: Date;
}
