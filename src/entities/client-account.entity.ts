import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('client_account')
export class ClientAccount {
  @PrimaryGeneratedColumn({ name: 'client_id' })
  client_id: number;

  @Column({ name: 'acc_type', type: 'varchar', length: 50, nullable: true })
  acc_type: string | null;

  @Column({ name: 'cd_code', type: 'varchar', length: 15, nullable: true })
  cd_code: string | null;

  @Column({ name: 'f_name', type: 'varchar', length: 500, nullable: true })
  f_name: string | null;

  @Column({ name: 'l_name', type: 'char', length: 250, nullable: true })
  l_name: string | null;

  @Column({ name: 'nationality', type: 'char', length: 15, nullable: true })
  nationality: string | null;

  @Column({ name: 'ID', type: 'varchar', length: 15, nullable: true })
  ID: string | null;

  @Column({ name: 'DzongkhagID', type: 'int', width: 4, nullable: true, default: 14 })
  DzongkhagID: number | null;

  @Column({ name: 'gewog_id', type: 'int', width: 4, nullable: true })
  gewog_id: number | null;

  @Column({ name: 'village_id', type: 'int', width: 4, nullable: true })
  village_id: number | null;

  @Column({ name: 'tpn', type: 'varchar', length: 10, nullable: true })
  tpn: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 15, nullable: true })
  phone: string | null;

  @Column({ name: 'email', type: 'varchar', length: 50, nullable: true })
  email: string | null;

  @Column({ name: 'bank_id', type: 'tinyint', width: 3, nullable: true })
  bank_id: number | null;

  @Column({ name: 'bank_account', type: 'varchar', length: 50, nullable: true })
  bank_account: string | null;

  @Column({ name: 'bro_comm_id', type: 'bigint', width: 10, nullable: true, default: 0 })
  bro_comm_id: number | null;

  @Column({ name: 'address', type: 'char', length: 200, nullable: true })
  address: string | null;

  @Column({ name: 'institution_id', type: 'varchar', length: 50, nullable: true })
  institution_id: string | null;

  @Column({ name: 'title', type: 'varchar', length: 100, nullable: true })
  title: string | null;

  @Column({ name: 'occupation', type: 'varchar', length: 15, nullable: true, default: '101' })
  occupation: string | null;

  @Column({ name: 'bank_account_type', type: 'varchar', length: 15, nullable: true })
  bank_account_type: string | null;

  @Column({ name: 'license_no', type: 'varchar', length: 50, nullable: true })
  license_no: string | null;

  @Column({ name: 'passport', type: 'varchar', length: 20, nullable: true })
  passport: string | null;

  @Column({ name: 'dob', type: 'date', nullable: true })
  dob: Date | null;

  @Column({ name: 'oversea_phone_no', type: 'bigint', width: 20, nullable: true })
  oversea_phone_no: number | null;

  @Column({ name: 'permanent_address', type: 'varchar', length: 255, nullable: true })
  permanent_address: string | null;

  @Column({ name: 'guardian_name', type: 'varchar', length: 200, nullable: true })
  guardian_name: string | null;

  @Column({ name: 'gender', type: 'varchar', length: 200, nullable: true })
  gender: string | null;

  @Column({ name: 'marital_status', type: 'varchar', length: 200, nullable: true })
  marital_status: string | null;

  @Column({ name: 'user_name', type: 'varchar', length: 50, nullable: true })
  user_name: string | null;

  @Column({ name: 'ca_date', type: 'datetime', nullable: true, default: () => 'CURRENT_TIMESTAMP' })
  ca_date: Date | null;
}

