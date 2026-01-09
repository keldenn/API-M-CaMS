# Pending Orders WebSocket Flow Documentation

## Overview
The **Pending Orders WebSocket** provides real-time updates for pending orders (buy/sell) for specific usernames. It uses the `/pendingOrders` namespace and is implemented using Socket.IO.

---

## Architecture Components

### 1. **PendingOrdersGateway** (`src/orders/pending-orders.gateway.ts`)
- **Namespace**: `/pendingOrders`
- **Transport**: WebSocket and polling (fallback)
- **Configuration**:
  - `pingTimeout`: 60 seconds
  - `pingInterval`: 25 seconds
  - `CORS`: Enabled for all origins (`*`)
  - `allowEIO3`: true (Socket.IO v3 compatibility)

### 2. **OrdersService** (`src/orders/orders.service.ts`)
- Provides the `getPendingOrders(username)` method that fetches pending orders from the database
- Queries the `orders` table joined with `symbol` table

### 3. **OrdersModule** (`src/orders/orders.module.ts`)
- Registers both `OrdersService` and `PendingOrdersGateway` as providers
- Exports both for potential use in other modules

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT CONNECTION FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

1. Client connects to WebSocket
   ┌──────────────┐
   │   Client     │  ──connect()──>  ws://server/pendingOrders
   └──────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │     PendingOrdersGateway.handleConnection()    │
   │  - Logs connection                             │
   │  - Sets up error handlers                      │
   │  - Sets up disconnect handler                  │
   │  - Sets 60s timeout for subscription          │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   [Client connected but NOT subscribed yet]
   (60s timeout: if not subscribed, client is disconnected)


┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUBSCRIPTION FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

2. Client subscribes to pending orders
   ┌──────────────┐
   │   Client     │  ──emit('subscribe', {username: 'user123'})──>
   └──────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │   PendingOrdersGateway.handleSubscribe()       │
   │  - Validates username                          │
   │  - Clears connection timeout                   │
   │  - Stores client in connectedClients Map       │
   │     {clientId: {socket, username}}             │
   │  - Starts auto-refresh interval (if not started)│
   └────────────────────────────────────────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │   OrdersService.getPendingOrders(username)     │
   │  - Queries database (orders + symbol tables)   │
   │  - Returns PendingOrdersResponseDto            │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   ┌──────────────┐
   │   Client     │  <──emit('pendingOrdersData', data)──
   └──────────────┘
   [Client receives initial pending orders data]


┌─────────────────────────────────────────────────────────────────────────────┐
│                        AUTO-REFRESH FLOW (Every 60s)                         │
└─────────────────────────────────────────────────────────────────────────────┘

3. Automatic Refresh Interval
   ┌────────────────────────────────────────────────┐
   │  Auto-refresh Timer (60 second interval)      │
   │  Started when first client subscribes         │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │  refreshAllSubscriptions()                     │
   │  - Gets all unique usernames from clients      │
   │  - For each username:                          │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │   OrdersService.getPendingOrders(username)     │
   │  - Fetches latest pending orders from DB       │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │   broadcastPendingOrdersUpdate(username, data) │
   │  - Finds all clients subscribed to username    │
   │  - Checks if socket is connected               │
   │  - Emits 'pendingOrdersUpdate' to each client  │
   │  - Cleans up disconnected clients              │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   ┌──────────────┐
   │   Client(s)  │  <──emit('pendingOrdersUpdate', data)──
   └──────────────┘
   [All subscribed clients receive update]


┌─────────────────────────────────────────────────────────────────────────────┐
│                         MANUAL REFRESH FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘



┌─────────────────────────────────────────────────────────────────────────────┐
│                         UNSUBSCRIBE FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────┘

5. Client unsubscribes
   ┌──────────────┐
   │   Client     │  ──emit('unsubscribe')──>
   └──────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │   PendingOrdersGateway.handleUnsubscribe()     │
   │  - Removes client from connectedClients Map    │
   └────────────────────────────────────────────────┘
                        │
                        ▼
   [Client remains connected but not subscribed]
   (If no clients remain, auto-refresh stops)


┌─────────────────────────────────────────────────────────────────────────────┐
│                         DISCONNECTION FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

6. Client disconnects
   ┌──────────────┐
   │   Client     │  ──disconnect()──>
   └──────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │   PendingOrdersGateway.handleDisconnect()      │
   │  - Cleans up connection timeout                │
   │  - Removes client from connectedClients Map    │
   │  - Stops auto-refresh if no clients remain     │
   └────────────────────────────────────────────────┘
```

---

## Event Messages

### Client → Server Events

#### 1. `subscribe`
```javascript
{
  username: string  // Required: Username to subscribe to
}
```
**Response**: 
- Success: `{ status: 'subscribed', username: string }`
- Error: `{ status: 'error', message: string }`

**Server Actions**:
- Validates username
- Stores client-username mapping
- Starts auto-refresh interval (if first client)
- Fetches and sends initial data via `pendingOrdersData` event

#### 2. `unsubscribe`
```javascript
// No body required
```
**Response**: `{ status: 'unsubscribed' }`

**Server Actions**:
- Removes client from subscription list
- Stops auto-refresh if no clients remain

#### 3. `refresh`
```javascript
{
  username?: string  // Optional: If not provided, uses stored username
}
```
**Response**:
- Success: `{ status: 'refreshed', username: string }`
- Error: `{ status: 'error', message: string }`

**Server Actions**:
- Fetches latest pending orders
- Sends data via `pendingOrdersData` event

### Server → Client Events

#### 1. `pendingOrdersData`
```typescript
{
  success: boolean,
  data: PendingOrderItemDto[],
  count: number
}
```
**Sent when**:
- Initial subscription
- Manual refresh request

#### 2. `pendingOrdersUpdate`
```typescript
{
  success: boolean,
  data: PendingOrderItemDto[],
  count: number
}
```
**Sent when**:
- Auto-refresh interval (every 60 seconds)
- Broadcasts to all clients subscribed to the username

#### 3. `error`
```typescript
{
  error: true,
  message: string
}
```
**Sent when**:
- Invalid subscription request
- Database errors
- Validation failures

---

## Data Structures

### PendingOrdersResponseDto
```typescript
{
  success: boolean,
  data: PendingOrderItemDto[],
  count: number
}
```

### PendingOrderItemDto
```typescript
{
  cd_code: string,
  participant_code: string,
  member_broker: string,
  side: 'B' | 'S',  // B = Buy, S = Sell
  order_date: string,  // ISO format
  buy_vol: string | null,
  sell_vol: string | null,
  order_size: string,
  order_id: string,
  symbol_id: string,
  price: string,
  commis_amt: string,
  flag_id: string,
  symbol: string
}
```

---

## Key Features

### 1. **Auto-Refresh Mechanism**
- **Interval**: 60 seconds (configurable via `REFRESH_INTERVAL_MS`)
- **Trigger**: Started when first client subscribes
- **Behavior**: 
  - Fetches pending orders for all unique usernames
  - Broadcasts updates only to clients subscribed to each username
  - Stops automatically when no clients remain

### 2. **Client Management**
- **Storage**: `Map<clientId, {socket: Socket, username: string}>`
- **Cleanup**: Automatically removes disconnected clients
- **Validation**: Connection timeout (60s) if client doesn't subscribe

### 3. **Connection Timeout**
- **Duration**: 60 seconds
- **Purpose**: Disconnects clients that connect but never subscribe
- **Cleared**: When client successfully subscribes

### 4. **Error Handling**
- Connection errors are logged
- Database errors emit error events to clients
- Disconnected sockets are cleaned up automatically

---

## Database Query

The `getPendingOrders` method queries:
```sql
SELECT 
  a.cd_code,
  a.participant_code,
  a.member_broker,
  a.side,
  a.order_date,
  CAST(a.buy_vol AS CHAR) AS buy_vol,
  CAST(a.sell_vol AS CHAR) AS sell_vol,
  CAST(a.order_size AS CHAR) AS order_size,
  CAST(a.order_id AS CHAR) AS order_id,
  CAST(a.symbol_id AS CHAR) AS symbol_id,
  CAST(a.price AS CHAR) AS price,
  CAST(a.commis_amt AS CHAR) AS commis_amt,
  CAST(a.flag_id AS CHAR) AS flag_id,
  b.symbol
FROM orders a
INNER JOIN symbol b ON a.symbol_id = b.symbol_id
WHERE a.order_entry = ?
ORDER BY a.side DESC  -- Sell orders first (S), then Buy orders (B)
```

---

## Important Notes

### ⚠️ Current Limitation
**The WebSocket does NOT automatically broadcast when orders are created, updated, or deleted through the REST API.** 

- Updates only occur through:
  1. **Auto-refresh interval** (every 60 seconds)
  2. **Manual refresh** request from client

### 🔄 Real-time Updates
To get real-time updates when orders change, you would need to:
1. Inject `PendingOrdersGateway` into `OrdersService`
2. Call `broadcastPendingOrdersUpdate()` after:
   - `createNewOrder()`
   - `updateOrder()`
   - `deleteOrder()`

### 📊 Current Behavior
- Clients receive updates every 60 seconds automatically
- Manual refresh provides immediate updates
- Multiple clients can subscribe to the same username
- Each client receives updates independently

---

## Client Implementation Example

```javascript
// Connect to WebSocket
const socket = io('https://server.com/pendingOrders', {
  transports: ['websocket', 'polling']
});

// Handle connection
socket.on('connect', () => {
  console.log('Connected');
  
  // Subscribe to pending orders for a username
  socket.emit('subscribe', { username: 'user123' });
});

// Receive initial data
socket.on('pendingOrdersData', (data) => {
  console.log('Initial data:', data);
  // data = { success: true, data: [...], count: number }
});

// Receive auto-refresh updates (every 60s)
socket.on('pendingOrdersUpdate', (data) => {
  console.log('Updated data:', data);
});

// Handle errors
socket.on('error', (error) => {
  console.error('Error:', error.message);
});

// Manual refresh
socket.emit('refresh', { username: 'user123' });

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
  namespace: '/pendingOrders',
  pingTimeout: 60000,      // 60 seconds
  pingInterval: 25000,     // 25 seconds
  transports: ['websocket', 'polling'],
  allowEIO3: true
})
```

### Constants
- `REFRESH_INTERVAL_MS`: 60000 (60 seconds)
- Connection timeout: 60000 (60 seconds)

---

## Flow Summary

1. **Client connects** → Gateway accepts connection
2. **Client subscribes** → Gateway stores mapping, fetches initial data, starts auto-refresh
3. **Auto-refresh runs** → Every 60s, fetches data and broadcasts to subscribed clients
4. **Manual refresh** → Client can request immediate refresh
5. **Client disconnects** → Gateway cleans up, stops auto-refresh if no clients remain

---

## Testing

A test client HTML file is provided: `pending-orders-websocket-test-client.html`

Features:
- Connection management
- Subscribe/Unsubscribe
- Manual refresh
- Real-time data display
- Event logging
- Auto-reconnection

---

*Last Updated: Based on current codebase analysis*

