export class HoldingsResponseDto {
  symbol: string;
  security_type: string;
  volume: number;
  pending_out_vol: number;
  pending_in_vol: number;
  pledge_volume: number;
  block_volume: number;
  total: number;
}
