import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('security_type_masters')
export class SecurityTypeMaster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'security_type' })
  security_type: string;

  @Column({ name: 'precise_name' })
  precise_name: string;

  @Column()
  status: number;
}
