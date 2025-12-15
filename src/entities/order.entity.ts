import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn({ name: 'order_id' })
  order_id: number;

  @Column({ name: 'cd_code' })
  cd_code: string;

  @Column({ name: 'participant_code' })
  participant_code: string;

  @Column({ name: 'member_broker' })
  member_broker: string;

  @Column({ name: 'order_entry' })
  order_entry: string;

  @Column({
    name: 'buy_vol',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  buy_vol: number;

  @Column({
    name: 'sell_vol',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  sell_vol: number;

  @Column({ name: 'order_size', type: 'decimal', precision: 15, scale: 2 })
  order_size: number;

  @Column({ name: 'symbol_id' })
  symbol_id: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  price: number;

  @Column()
  side: string;

  @Column({ name: 'commis_amt', type: 'decimal', precision: 15, scale: 2 })
  commis_amt: number;

  @Column({ name: 'flag_id' })
  flag_id: string;
}
