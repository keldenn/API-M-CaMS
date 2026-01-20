import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Unique, Index } from 'typeorm';

@Entity('fcm_tokens')
@Unique('UQ_cd_code_device_id', ['cd_code', 'device_id'])
@Index('IDX_cd_code', ['cd_code'])
export class FcmToken {
  @PrimaryGeneratedColumn({ name: 'fcm_token_id' })
  fcm_token_id: number;

  @Column({ name: 'cd_code', type: 'varchar', length: 255 })
  cd_code: string;

  @Column({ name: 'fcm_token', type: 'text' })
  fcm_token: string;

  @Column({ name: 'device_id', type: 'varchar', length: 255 })
  device_id: string;

  @Column({
    name: 'platform',
    type: 'enum',
    enum: ['ios', 'android'],
    nullable: true,
  })
  platform: 'ios' | 'android';

  @Column({ name: 'device_name', type: 'varchar', length: 255, nullable: true })
  device_name: string;

  @Column({ name: 'app_version', type: 'varchar', length: 50, nullable: true })
  app_version: string;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  last_used_at: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}




