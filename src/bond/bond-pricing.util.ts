export interface BondPlacementAmounts {
  tradeValue: number;
  commission: number;
  gst: number;
  totalAmount: number;
}

interface CommissionBracket {
  min: number;
  max: number;
  commissionMin: number;
  commissionMax: number;
}

const COMMISSION_BRACKETS: CommissionBracket[] = [
  { min: 1000, max: 100000, commissionMin: 10, commissionMax: 100 },
  { min: 100001, max: 250000, commissionMin: 105, commissionMax: 200 },
  { min: 250001, max: 500000, commissionMin: 210, commissionMax: 300 },
  { min: 500001, max: 1000000, commissionMin: 320, commissionMax: 450 },
  { min: 1000001, max: 2500000, commissionMin: 475, commissionMax: 600 },
  { min: 2500001, max: 5000000, commissionMin: 650, commissionMax: 750 },
  { min: 5000001, max: 10000000, commissionMin: 760, commissionMax: 1500 },
  {
    min: 10000001,
    max: 25000000,
    commissionMin: 1550,
    commissionMax: 2500,
  },
  {
    min: 25000001,
    max: 50000000,
    commissionMin: 2725,
    commissionMax: 4500,
  },
  {
    min: 50000001,
    max: 100000000,
    commissionMin: 5000,
    commissionMax: 10000,
  },
];

export function roundBondAmount(value: number, scale = 2): number {
  const factor = 10 ** scale;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateBondCommission(tradeValue: number): number {
  if (!Number.isFinite(tradeValue) || tradeValue <= 0) {
    return 0;
  }

  if (tradeValue <= 1000) {
    return 10;
  }

  for (const bracket of COMMISSION_BRACKETS) {
    if (tradeValue <= bracket.max) {
      const ratio = Math.max(
        0,
        Math.min(1, (tradeValue - bracket.min) / (bracket.max - bracket.min)),
      );
      return roundBondAmount(
        bracket.commissionMin +
          ratio * (bracket.commissionMax - bracket.commissionMin),
      );
    }
  }

  return 20000;
}

export function calculateBondGst(
  commission: number,
  gstRegister: string | null | undefined,
): number {
  return gstRegister?.trim().toUpperCase() === 'Y'
    ? roundBondAmount(commission * 0.05)
    : 0;
}

export function calculateBondPlacementAmounts(
  price: number,
  volume: number,
  gstRegister: string | null | undefined,
): BondPlacementAmounts {
  const tradeValue = roundBondAmount(price * volume);
  const commission = calculateBondCommission(tradeValue);
  const gst = calculateBondGst(commission, gstRegister);
  const totalAmount = roundBondAmount(tradeValue + commission + gst);

  return { tradeValue, commission, gst, totalAmount };
}
