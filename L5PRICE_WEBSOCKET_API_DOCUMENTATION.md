# L5Price WebSocket API Documentation

## 1. Connection Details

### WebSocket URL/Endpoint
- **Full URL**: `${baseUrl}/L5price`
- **Namespace**: `/L5price` (case-sensitive)
- **Example**: `http://localhost:3000/L5price` or `http://192.168.20.4/L5price`

### Authentication
- **Required**: ❌ **NO** - Authentication is **NOT required** for the L5price WebSocket namespace
- The gateway does not implement any authentication guards
- No JWT tokens or headers are required for connection
- Connection is open to all clients

### Connection Options
```javascript
socket = io(`${baseUrl}/L5price`, {
  transports: ['websocket', 'polling'],
  timeout: 10000
});
```

---

## 2. Event Names

### Client → Server Events

| Event Name | Description | Parameters |
|------------|-------------|------------|
| `subscribe` | Subscribe to L5price data updates | `{}` (empty object) |
| `unsubscribe` | Unsubscribe from L5price data updates | `{}` (empty object) |

### Server → Client Events

| Event Name | Description | Data Format |
|------------|-------------|-------------|
| `l5PriceData` | Initial data sent after subscription | `L5PriceDto[]` (array) |
| `l5PriceUpdate` | Real-time updates when data changes | `L5PriceDto[]` (array) |
| `error` | Error messages | `{ message: string }` |
| `connect` | Connection established | - |
| `disconnect` | Connection closed | `reason: string` |
| `connect_error` | Connection failed | `error: Error` |

---

## 3. Subscription

### Subscribe
```javascript
socket.emit('subscribe', {});
```
- **Parameters**: Empty object `{}` - **NO parameters required**
- **Behavior**: 
  - Immediately sends initial data via `l5PriceData` event
  - Client starts receiving updates via `l5PriceUpdate` event
  - Subscription is **NOT automatic** on connect - must call `subscribe` manually

### Unsubscribe
```javascript
socket.emit('unsubscribe', {});
```
- **Parameters**: Empty object `{}` - **NO parameters required**
- **Behavior**: Stops receiving updates (but connection remains open)

### Auto-subscribe
- **NO** - You must manually call `subscribe` after connecting
- The server does NOT auto-subscribe clients on connection

---

## 4. Data Format

### L5PriceDto Structure
```typescript
{
  symbol: string;      // Stock symbol (e.g., "AAPL", "BNBL")
  price: number;       // Price as a number (always numeric, never string)
  date: Date;          // Date object (serialized as ISO 8601 in JSON)
}
```

### Example Data
```json
[
  {
    "symbol": "BNBL",
    "price": 123.45,
    "date": "2025-01-15T00:00:00.000Z"
  },
  {
    "symbol": "BNBL",
    "price": 122.30,
    "date": "2025-01-14T00:00:00.000Z"
  }
]
```

### Data Format Details

#### Date Format
- **Type**: JavaScript `Date` object
- **JSON Serialization**: ISO 8601 format (`"2025-01-15T00:00:00.000Z"`)
- **Example**: `"2025-01-15T00:00:00.000Z"`

#### Price Format
- **Type**: `number` (always numeric, never string)
- **Conversion**: Server uses `parseFloat()` to ensure numeric type
- **Precision**: Decimal values supported (e.g., `123.45`)

#### Additional Fields
- **NO other fields** - Only `symbol`, `price`, and `date` are included

---

## 5. Data Structure

### Data Array
- **Type**: Always an array of objects (`L5PriceDto[]`)
- **Content**: Contains data for **ALL listed companies** (not filtered by symbol)
- **Empty Array**: Returns `[]` if no data is available

### Records Per Symbol
- **Maximum**: Up to **5 days** of data per symbol
- **Actual Count**: May be less than 5 if fewer days of data exist
- **Selection Logic**: 
  - Gets the latest price per day (if multiple prices exist for same day)
  - Then selects the most recent 5 days per symbol
  - Only includes symbols with `security_type = 'OS'` and `status = 1`

### Data Sorting
- **Primary Sort**: By `symbol` (alphabetically)
- **Secondary Sort**: By `date DESC` (newest first within each symbol)
- **Example Order**:
  ```
  AAPL - 2025-01-15 (newest)
  AAPL - 2025-01-14
  AAPL - 2025-01-13
  ...
  BNBL - 2025-01-15 (newest)
  BNBL - 2025-01-14
  ...
  ```

### Data Scope
- **All Symbols**: Returns data for all eligible symbols in one array
- **No Filtering**: Cannot subscribe to specific symbols - always returns all
- **Grouping**: Client must group by symbol if needed

---

## 6. Error Handling

### Error Event
```javascript
socket.on('error', (error) => {
  console.error('Server error:', error.message);
});
```

### Error Format
```json
{
  "message": "Failed to fetch L5price data"
}
```

### Error Scenarios

| Scenario | Event | Error Message |
|----------|-------|---------------|
| Database query fails | `error` | "Failed to fetch L5price data" |
| Connection timeout | `connect_error` | Connection error message |
| Server disconnect | `disconnect` | Disconnect reason string |

### Connection Failures
- **`connect_error`**: Emitted when connection fails
- **`disconnect`**: Emitted when connection is lost
- **Error handling**: Server logs errors but continues operation

---

## 7. Connection Behavior

### Reconnection
- **Auto-reconnect**: Socket.IO client handles reconnection automatically (if configured)
- **Server-side**: Server does not implement custom reconnection logic
- **Recommendation**: Configure Socket.IO client with auto-reconnect:
  ```javascript
  socket = io(`${baseUrl}/L5price`, {
    transports: ['websocket', 'polling'],
    timeout: 10000,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });
  ```

### Heartbeat/Ping
- **Socket.IO Built-in**: Socket.IO automatically handles ping/pong for keepalive
- **No Custom Heartbeat**: Server does not send custom heartbeat messages
- **Default Interval**: Socket.IO default ping interval (typically 25 seconds)

### Rate Limiting
- **Subscription**: No rate limits on `subscribe`/`unsubscribe` calls
- **Updates**: Updates are broadcast to all connected clients
- **Monitoring Interval**: Server checks for data changes every **60 seconds** (60000ms)
- **Update Frequency**: Updates only sent when data actually changes

### Update Mechanism
- **Polling**: Server polls database every 60 seconds
- **Change Detection**: Compares current data with last known data
- **Broadcast**: Only broadcasts `l5PriceUpdate` if data has changed
- **Efficiency**: Only checks when clients are connected

---

## 8. Special Requirements

### Connection Parameters
- **Query Parameters**: ❌ None required
- **Headers**: ❌ None required
- **Authentication**: ❌ Not required

### Connection Options
- **Transports**: Supports both `websocket` and `polling` (fallback)
- **CORS**: Enabled for all origins (`origin: '*'`)

### Initial Data
- **On Subscribe**: Immediately receives full dataset via `l5PriceData` event
- **On Update**: Receives full updated dataset via `l5PriceUpdate` event
- **No Incremental Updates**: Always sends complete dataset, not deltas

---

## 9. Complete Example

### JavaScript/TypeScript Client
```javascript
import io from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';
const socket = io(`${SERVER_URL}/L5price`, {
  transports: ['websocket', 'polling'],
  timeout: 10000,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// Connection events
socket.on('connect', () => {
  console.log('Connected to L5price WebSocket');
  // Manually subscribe after connection
  socket.emit('subscribe', {});
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});

// Data events
socket.on('l5PriceData', (data) => {
  console.log('Initial data received:', data.length, 'records');
  // Process data
  processL5PriceData(data);
});

socket.on('l5PriceUpdate', (data) => {
  console.log('Data updated:', data.length, 'records');
  // Process updated data
  processL5PriceData(data);
});

// Error handling
socket.on('error', (error) => {
  console.error('Server error:', error.message);
});

// Subscribe function
function subscribe() {
  if (socket.connected) {
    socket.emit('subscribe', {});
  }
}

// Unsubscribe function
function unsubscribe() {
  if (socket.connected) {
    socket.emit('unsubscribe', {});
  }
}

// Process data
function processL5PriceData(data) {
  // Group by symbol
  const grouped = {};
  data.forEach(item => {
    if (!grouped[item.symbol]) {
      grouped[item.symbol] = [];
    }
    grouped[item.symbol].push(item);
  });
  
  // Process each symbol's data
  Object.keys(grouped).forEach(symbol => {
    const symbolData = grouped[symbol];
    console.log(`${symbol}: ${symbolData.length} days of data`);
  });
}

// Cleanup
function disconnect() {
  if (socket) {
    socket.disconnect();
  }
}
```

---

## 10. Summary

### Quick Reference

| Item | Value |
|------|-------|
| **Namespace** | `/L5price` |
| **Authentication** | ❌ Not required |
| **Subscribe Parameters** | `{}` (empty) |
| **Initial Event** | `l5PriceData` |
| **Update Event** | `l5PriceUpdate` |
| **Data Format** | Array of `{symbol, price, date}` |
| **Price Type** | `number` |
| **Date Format** | ISO 8601 (`Date` object) |
| **Records per Symbol** | Up to 5 days |
| **Update Interval** | 60 seconds (when data changes) |
| **Auto-subscribe** | ❌ No - manual subscribe required |

### Key Points
1. ✅ No authentication required
2. ✅ Empty object for subscribe/unsubscribe
3. ✅ Manual subscription after connection
4. ✅ Full dataset on each update (not incremental)
5. ✅ Updates only when data changes
6. ✅ Data sorted by symbol, then date DESC
7. ✅ Up to 5 days per symbol
8. ✅ All symbols in one array

---

## 11. Server Implementation Details

### Gateway File
- **Location**: `src/stocks/l5price.gateway.ts`
- **Namespace**: `/L5price`
- **CORS**: Enabled for all origins

### Service File
- **Location**: `src/stocks/l5price.service.ts`
- **Monitoring Interval**: 60000ms (60 seconds)
- **Query**: Complex SQL query selecting latest 5 days per symbol

### DTO File
- **Location**: `src/stocks/dto/l5price.dto.ts`
- **Fields**: `symbol: string`, `price: number`, `date: Date`

