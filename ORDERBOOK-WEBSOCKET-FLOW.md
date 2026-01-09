# Orderbook WebSocket Flow Documentation

## Overview
The **Orderbook WebSocket** provides real-time updates for orderbook data (buy/sell volumes at different price levels) for specific stock symbols. It uses the `/orderbook` namespace and is implemented using Socket.IO.

---

## Architecture Components

### 1. **OrderbookGateway** (`src/stocks/orderbook.gateway.ts`)
- **Namespace**: `/orderbook`
- **Transport**: WebSocket and polling (fallback)
- **Configuration**:
  - `CORS`: Enabled for all origins (`*`)
  - No explicit ping/pingInterval settings (uses Socket.IO defaults)

### 2. **OrderbookService** (`src/stocks/orderbook.service.ts`)
- Provides the `getOrderbook(symbol)` method that fetches orderbook data from the database
- Queries the `orders` table joined with `symbol` table
- Calculates cumulative buy/sell volumes and discovered price
- Monitors orderbook changes and broadcasts updates when data changes

### 3. **StocksModule** (`src/stocks/stocks.module.ts`)
- Registers both `OrderbookService` and `OrderbookGateway` as providers
- Exports both for potential use in other modules

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT CONNECTION FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

1. Client connects to WebSocket
   ┌──────────────┐
   │   Client     │  ──connect()──>  ws://server/orderbook
   └──────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │     OrderbookGateway.handleConnection()        │
   │  - Logs connection                             │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   [Client connected but NOT subscribed yet]


┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUBSCRIPTION FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

2. Client subscribes to orderbook
   ┌──────────────┐
   │   Client     │  ──emit('subscribe', {Symbol: 'AAPL'})──>
   └──────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │   OrderbookGateway.handleSubscribe()           │
   │  - Validates Symbol                            │
   │  - Stores client in connectedClients Map       │
   │     {clientId: {socket, symbol}}                │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │   OrderbookService.getOrderbook(symbol)        │
   │  - Queries database (orders + symbol tables)   │
   │  - Calculates cumulative volumes               │
   │  - Calculates discovered price                 │
   │  - Returns OrderbookResponseDto                │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │   OrderbookService.storeInitialOrderbookData() │
   │  - Stores initial data for change detection    │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   ┌──────────────┐
   │   Client     │  <──emit('orderbookData', data)──
   └──────────────┘
   [Client receives initial orderbook data]


┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTO-MONITORING FLOW (Every 30s)                          │
└─────────────────────────────────────────────────────────────────────────────┘

3. Automatic Change Monitoring Interval
   ┌────────────────────────────────────────────────┐
   │  Orderbook Monitoring Timer (30 second interval)│
   │  Started when OrderbookService initializes    │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │  startOrderbookMonitoring()                    │
   │  - Gets all unique symbols from clients        │
   │  - For each symbol:                            │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │   OrderbookService.getOrderbook(symbol)        │
   │  - Fetches latest orderbook from DB            │
   │  - Calculates volumes and discovered price     │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │   hasOrderbookChanged(lastData, currentData)   │
   │  - Compares discovered price                   │
   │  - Compares number of levels                   │
   │  - Compares each price level data              │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   [If changed]
   ┌────────────────────────────────────────────────┐
   │   OrderbookGateway.broadcastOrderbookUpdate()  │
   │  - Finds all clients subscribed to symbol      │
   │  - Emits 'orderbookUpdate' to each client      │
   │  - Updates stored orderbook data               │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   ┌──────────────┐
   │   Client(s)  │  <──emit('orderbookUpdate', data)──
   └──────────────┘
   [All subscribed clients receive update only if data changed]


┌─────────────────────────────────────────────────────────────────────────────┐
│                         UNSUBSCRIBE FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────┘

4. Client unsubscribes
   ┌──────────────┐
   │   Client     │  ──emit('unsubscribe')──>
   └──────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │   OrderbookGateway.handleUnsubscribe()         │
   │  - Removes client from connectedClients Map   │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   [Client remains connected but not subscribed]
   (Monitoring continues for other subscribed symbols)


┌─────────────────────────────────────────────────────────────────────────────┐
│                         DISCONNECTION FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

5. Client disconnects
   ┌──────────────┐
   │   Client     │  ──disconnect()──>
   └──────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │   OrderbookGateway.handleDisconnect()          │
   │  - Removes client from connectedClients Map   │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   [Client removed from monitoring]
   (Monitoring continues for other subscribed symbols)
```

---

## Event Messages

### Client → Server Events

#### 1. `subscribe`
```javascript
{
  Symbol: string  // Required: Stock symbol to subscribe to (e.g., 'AAPL')
}
```
**Response**: 
- Success: `{ status: 'subscribed', symbol: string }`
- Error: `{ status: 'error', message: string }`

**Server Actions**:
- Validates Symbol parameter
- Stores client-symbol mapping
- Fetches and sends initial data via `orderbookData` event
- Stores initial data for change detection

#### 2. `unsubscribe`
```javascript
// No body required
```
**Response**: `{ status: 'unsubscribed' }`

**Server Actions**:
- Removes client from subscription list
- Monitoring continues for other subscribed symbols

### Server → Client Events

#### 1. `orderbookData`
```typescript
{
  error: boolean,
  message: string,
  data: OrderbookLevelDto[],
  discoveredPrice: string,
  timestamp: string
}
```
**Sent when**:
- Initial subscription

#### 2. `orderbookUpdate`
```typescript
{
  data: OrderbookLevelDto[],
  discoveredPrice: string
}
```
**Sent when**:
- Orderbook data changes detected (every 30 seconds check)
- Only broadcasts if data actually changed
- Broadcasts to all clients subscribed to the symbol

#### 3. `error`
```typescript
{
  error: true,
  message: string
}
```
**Sent when**:
- Invalid subscription request (missing Symbol)
- Database errors
- Validation failures

---

## Data Structures

### OrderbookResponseDto
```typescript
{
  error: boolean,
  message: string,
  data: OrderbookLevelDto[],
  discoveredPrice: string,
  timestamp: string  // Format: 'YYYY-MM-DD HH:mm:ss'
}
```

### OrderbookLevelDto
```typescript
{
  BuyVol: number,           // Cumulative buy volume at this price level
  Price: string,            // Price level
  SellVol: number,          // Cumulative sell volume at this price level
  Discovered: string,       // Discovered price (price with max tradable volume)
  maxTradable: number       // Maximum tradable volume at this price level
}
```

---

## Key Features

### 1. **Change Detection & Monitoring**
- **Interval**: 30 seconds (configurable via `CHECK_INTERVAL`)
- **Trigger**: Started when `OrderbookService` initializes
- **Behavior**: 
  - Fetches orderbook for all unique subscribed symbols
  - Compares current data with last known data
  - Only broadcasts updates when data actually changes
  - Checks for changes in:
    - Discovered price
    - Number of price levels
    - Individual price level data (Price, BuyVol, SellVol, maxTradable, Discovered)

### 2. **Client Management**
- **Storage**: `Map<clientId, {socket: Socket, symbol: string}>`
- **Cleanup**: Automatically removes disconnected clients
- **Multiple Subscriptions**: Each client can subscribe to one symbol at a time
- **Symbol Tracking**: Gateway tracks all unique symbols from connected clients

### 3. **Discovered Price Calculation**
- **Algorithm**: Finds the price level with the maximum tradable volume
- **Tradable Volume**: `min(BuyVol, SellVol)` at each price level
- **Requirement**: Only considers price levels where both BuyVol > 0 and SellVol > 0
- **Storage**: Cached per symbol in `discoveredPrices` Map

#### **Tie-Breaking Algorithm**
When multiple price levels have the same maximum tradable volume, the algorithm uses the following tie-breaking rule:

1. **Primary Selection**: Find all price levels with the maximum `maxTradable` value
2. **Tie-Breaking**: Among those with the same max tradable volume, select the **highest price**
3. **Implementation Details**:
   - Price levels are sorted in **descending order** (highest price first)
   - The algorithm iterates through the sorted array
   - When `max_tradable > current_max`, it updates the discovered price
   - When `max_tradable === current_max` (tie), it **does not update**, keeping the first (highest price) encountered
   - Result: The highest price among tied levels is selected

**Example**:
```
Price Level 1: Price = 150.50, maxTradable = 1000
Price Level 2: Price = 150.25, maxTradable = 1000  ← Same maxTradable
Price Level 3: Price = 150.00, maxTradable = 800

Discovered Price = 150.50 (highest price among those with maxTradable = 1000)
```

**Code Reference** (`orderbook.service.ts` lines 269-286):
- Array sorted by price descending: `sort((a, b) => parseFloat(b.price) - parseFloat(a.price))`
- Loop condition: `if (level.max_tradable > maxTradable)` - only updates when strictly greater
- Ties result in keeping the first (highest price) encountered

### 4. **Cumulative Volume Calculation**
- **Buy Volumes**: Cumulative sum of all buy orders at or above each price level
- **Sell Volumes**: Cumulative sum of all sell orders at or below each price level
- **Top 5 Levels**: Returns top 5 buy and top 5 sell levels
- **5th Level Special**: The 5th level shows total volume instead of cumulative

### 5. **Error Handling**
- Connection errors are logged
- Database errors emit error events to clients
- Disconnected sockets are cleaned up automatically
- Invalid symbols return empty data array (not an error)

---

## Database Query

The `getOrderbook` method uses a complex query with CTEs (Common Table Expressions):

```sql
-- Main query structure:
1. PriceLevels CTE: Gets all distinct price levels for the symbol
2. CumulativeBuy CTE: Calculates cumulative buy volumes (top 5, descending price)
3. CumulativeSell CTE: Calculates cumulative sell volumes (top 5, ascending price)
4. TotalBuyVol CTE: Gets total buy volume (lowest price's cumulative)
5. TotalSellVol CTE: Gets total sell volume (highest price's cumulative)
6. FilteredBuy CTE: Filters top 5 buy levels (5th shows total)
7. FilteredSell CTE: Filters top 5 sell levels (5th shows total)
8. UNION ALL: Combines buy and sell sides
9. Final SELECT: Merges same-price levels, calculates max_tradable
10. ORDER BY: Sorts by price descending
```

**Key Features**:
- Returns top 5 buy levels (highest prices first)
- Returns top 5 sell levels (lowest prices first)
- Merges levels with the same price
- Calculates `maxTradable = min(BuyVol, SellVol)` for each level
- Discovers price with maximum tradable volume

---

## Important Notes

### ✅ Real-time Change Detection
**The WebSocket automatically detects and broadcasts changes when orderbook data is modified.**

- Changes are detected through:
  1. **Auto-monitoring interval** (every 30 seconds)
  2. **Change comparison** (compares current vs last known data)
  3. **Selective broadcasting** (only sends updates when data actually changed)

### 🔄 Change Detection Logic
The `hasOrderbookChanged()` method checks:
1. If discovered price changed
2. If number of price levels changed
3. If any price level's data changed:
   - Price
   - BuyVol
   - SellVol
   - maxTradable
   - Discovered

### 🎯 Discovered Price Tie-Breaking
**When multiple price levels have the same maximum tradable volume:**

The algorithm uses a **highest price wins** strategy:
- Price levels are sorted in descending order (highest price first)
- The first price level encountered with the maximum `maxTradable` becomes the discovered price
- Subsequent price levels with the same `maxTradable` are ignored (tie-breaking favors higher prices)
- This ensures deterministic and predictable discovered price selection

**Algorithm Flow:**
1. Calculate `maxTradable = min(BuyVol, SellVol)` for each price level
2. Sort all price levels by price descending
3. Iterate through sorted levels
4. Track the maximum `maxTradable` value found
5. When a level has `maxTradable > current_max`, update discovered price
6. When a level has `maxTradable === current_max`, keep the existing (higher price) discovered price

**Both WebSocket and REST API use the same algorithm** - ensuring consistency across interfaces.

### 📊 Current Behavior
- Clients receive initial data immediately upon subscription
- Updates are sent only when data changes (not on every interval)
- Multiple clients can subscribe to the same symbol
- Each client receives updates independently
- Monitoring runs continuously (not per-client)

### ⚠️ Symbol Validation
- If symbol doesn't exist: Returns empty data array (not an error)
- If no orders for symbol: Returns empty data array (not an error)
- Invalid subscription: Returns error event

---

## Client Implementation Example

```javascript
// Connect to WebSocket
const socket = io('https://server.com/orderbook', {
  transports: ['websocket', 'polling']
});

// Handle connection
socket.on('connect', () => {
  console.log('Connected');
  
  // Subscribe to orderbook for a symbol
  socket.emit('subscribe', { Symbol: 'AAPL' });
});

// Receive initial data
socket.on('orderbookData', (data) => {
  console.log('Initial orderbook data:', data);
  // data = { 
  //   error: false, 
  //   message: 'Success',
  //   data: [...], 
  //   discoveredPrice: '150.25',
  //   timestamp: '2025-01-15 10:30:00'
  // }
});

// Receive updates (only when data changes)
socket.on('orderbookUpdate', (data) => {
  console.log('Orderbook updated:', data);
  // data = { 
  //   data: [...], 
  //   discoveredPrice: '150.30'
  // }
});

// Handle errors
socket.on('error', (error) => {
  console.error('Error:', error.message);
});

// Unsubscribe
socket.emit('unsubscribe');

// Disconnect
socket.disconnect();
```

---

## Configuration

### Gateway Configuration
```typescript
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/orderbook',
  transports: ['websocket', 'polling']
})
```

### Service Constants
- `CHECK_INTERVAL`: 30000 (30 seconds)
- Monitoring starts automatically when service initializes

---

## Flow Summary

1. **Service Initializes** → Starts orderbook monitoring interval (30s)
2. **Client connects** → Gateway accepts connection
3. **Client subscribes** → Gateway stores mapping, fetches initial data, stores for change detection
4. **Monitoring runs** → Every 30s, checks all subscribed symbols for changes
5. **Change detected** → Compares current vs last data, broadcasts update if changed
6. **Client receives update** → Only if data actually changed
7. **Client disconnects** → Gateway cleans up, monitoring continues for other symbols

---

## Testing

A test client HTML file is provided: `orderbook-websocket-test-client.html`

Features:
- Connection management
- Subscribe/Unsubscribe
- Real-time data display
- Orderbook table visualization
- Discovered price display
- Event logging
- Export to JSON
- REST API fallback

---

*Last Updated: Based on current codebase analysis*

