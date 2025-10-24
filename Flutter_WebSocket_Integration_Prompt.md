# Flutter WebSocket Integration Prompt

## Overview
You need to integrate two WebSocket namespaces and two REST APIs from a NestJS backend into a Flutter mobile application.

## WebSocket Namespaces

### 1. `/price_movement` Namespace
- **Purpose**: Real-time price movement data for specific symbols
- **Interval**: 30 seconds
- **Events**:
  - `subscribe` - Subscribe to price movement for a specific symbol
  - `unsubscribe` - Unsubscribe from updates
  - `priceMovementData` - Initial data when subscribing
  - `priceMovementUpdate` - Real-time updates when data changes
  - `error` - Error messages

**Data Structure**:
```json
[
  {
    "price": 150.25,
    "date": "2025-01-24T10:30:00.000Z"
  }
]
```

### 2. `/L5price` Namespace
- **Purpose**: Latest 5 days price movement for all listed companies
- **Interval**: 60 seconds
- **Events**:
  - `subscribe` - Subscribe to L5price data
  - `unsubscribe` - Unsubscribe from updates
  - `l5PriceData` - Initial data when subscribing
  - `l5PriceUpdate` - Real-time updates when data changes
  - `error` - Error messages

**Data Structure**:
```json
[
  {
    "symbol": "AAPL",
    "price": 150.25,
    "date": "2025-01-24T10:30:00.000Z"
  }
]
```

## REST APIs

### 1. Stock Prices API
- **Endpoint**: `GET /stocks/price`
- **Authentication**: Not required
- **Purpose**: Get current stock prices for all active stocks

### 2. L5Price API
- **Endpoint**: `GET /l5price`
- **Authentication**: Required (Bearer Token)
- **Purpose**: Get latest 5 days price movement data

## Integration Requirements

### Flutter Dependencies Needed
```yaml
dependencies:
  socket_io_client: ^2.0.3+1
  http: ^1.1.2
  provider: ^6.1.1  # or bloc: ^8.1.4
  shared_preferences: ^2.2.2
  json_annotation: ^4.8.1

dev_dependencies:
  json_serializable: ^6.7.1
  build_runner: ^2.4.7
```

### Key Implementation Points

1. **WebSocket Connection Management**
   - Handle connection/disconnection states
   - Implement reconnection logic
   - Show connection status in UI

2. **Data Models**
   - Create models for PriceMovement and L5Price
   - Implement JSON serialization
   - Handle date parsing

3. **State Management**
   - Use Provider or BLoC for state management
   - Handle real-time data updates
   - Manage connection states

4. **UI Components**
   - Price movement screen for specific symbols
   - L5Price screen showing all companies' 5-day data
   - Connection status indicators
   - Error handling with user feedback

5. **Authentication**
   - Store and manage Bearer tokens
   - Handle 401 errors gracefully
   - Implement token refresh if needed

6. **Error Handling**
   - Network connectivity issues
   - WebSocket connection failures
   - API authentication errors
   - Data parsing errors

### UI Screens Needed

1. **Price Movement Screen**
   - Symbol input field
   - Real-time price movement chart/list
   - Connection status indicator
   - Error messages

2. **L5Price Screen**
   - List of all companies with 5-day price data
   - Grouped by symbol with expandable cards
   - Statistics (total records, unique symbols)
   - Connection status indicator

3. **Home Screen**
   - Navigation to both screens
   - Connection status overview

### Technical Considerations

- **Performance**: Efficient data handling for real-time updates
- **Memory Management**: Proper disposal of WebSocket connections
- **Offline Handling**: Graceful degradation when offline
- **Testing**: Unit tests for services, integration tests for UI
- **Security**: Secure token storage and transmission



### Production Considerations

- Environment-specific API URLs
- Network monitoring and retry logic
- Background processing for WebSocket connections
- Proper error logging and analytics
- Security best practices for token management

This prompt provides all the necessary information to implement a complete Flutter mobile app integration with the WebSocket namespaces and REST APIs.
