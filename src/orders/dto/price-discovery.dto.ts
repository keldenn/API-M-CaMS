/**
 * DTOs for Price Discovery Feature
 * Used to track and notify users when their orders match at the discovered price
 */

/**
 * Represents the discovered price information for a symbol
 */
export interface DiscoveredPriceInfo {
  symbol_id: number;
  price: string;
  maxTradable: number;
  buyVolume: number;
  sellVolume: number;
  discoveredAt: Date;
}

/**
 * Represents a user whose order is at the discovered price
 */
export interface AffectedUser {
  cd_code: string;
  order_id: number;
  side: 'B' | 'S';
  volume: number;
  price: string;
}

/**
 * Price discovery event payload for WebSocket broadcast
 */
export interface PriceDiscoveredEvent {
  type: 'priceDiscovered';
  symbol_id: number;
  symbol_name?: string;
  price: string;
  maxTradable: number;
  buyVolume: number;
  sellVolume: number;
  affectedUsersCount: number;
  timestamp: string;
}

/**
 * Price discovery calculation result
 */
export interface PriceDiscoveryResult {
  hasDiscoveredPrice: boolean;
  discoveredPrice: string;
  maxTradable: number;
  buyVolume: number;
  sellVolume: number;
}

