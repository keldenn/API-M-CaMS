# Swagger UI Authentication Guide

## Overview
The Swagger UI is configured with JWT Bearer token authentication. Here's how to use it properly.

## Accessing Swagger UI
- **URL**: `http://localhost:3000/api`
- **Authentication**: JWT Bearer Token required for protected endpoints

## How to Use Authentication in Swagger

### Step 1: Access Swagger UI
1. Open your browser and navigate to `http://localhost:3000/api`
2. You'll see the Swagger UI interface with all available endpoints

### Step 2: Authenticate
1. Look for the **"Authorize"** button at the top right of the Swagger UI
2. Click the **"Authorize"** button
3. You'll see a popup with authentication options
4. In the **"JWT-auth"** section, enter your Bearer token in the format: `your-jwt-token-here`
5. Click **"Authorize"**
6. Click **"Close"** to close the popup

### Step 3: Test Protected Endpoints
1. Now you can test the `/l5price` endpoint
2. Click on the endpoint to expand it
3. Click **"Try it out"**
4. Click **"Execute"**
5. The request will include the Authorization header automatically

## Available Endpoints

### Public Endpoints (No Authentication Required)
- `GET /` - Application status
- `GET /stocks/price` - Stock prices
- `GET /stocks/market-stats` - Market statistics
- `GET /index` - Index data
- `GET /price-movement/{symbol}` - Price movement for specific symbol

### Protected Endpoints (Authentication Required)
- `GET /l5price` - L5price data (requires JWT token)

## Getting a JWT Token

To get a JWT token for testing, you need to:

1. **Login via Auth endpoints** (if available in your API)
2. **Use existing token** from your application
3. **Generate token** using your authentication system

### Example Token Format
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

## Troubleshooting

### Common Issues

1. **"Unauthorized" Error**
   - Make sure you've clicked "Authorize" in Swagger UI
   - Verify your token is valid and not expired
   - Check that the token format is correct (no "Bearer " prefix needed in Swagger)

2. **Token Not Working**
   - Ensure the token is not expired
   - Verify the token was generated for the correct user/role
   - Check that the token has the required permissions

3. **Swagger UI Not Loading**
   - Ensure the server is running on port 3000
   - Check that the `/api` endpoint is accessible
   - Verify CORS settings if accessing from different domain

## Security Notes

- **Never share your JWT tokens** in screenshots or public repositories
- **Tokens expire** - you may need to refresh them periodically
- **Use HTTPS in production** for secure token transmission
- **Store tokens securely** in your applications

## Testing Workflow

1. **Start the server**: `npm run start:dev`
2. **Open Swagger UI**: Navigate to `http://localhost:3000/api`
3. **Get a token**: Use your authentication system to obtain a JWT token
4. **Authorize in Swagger**: Click "Authorize" and enter your token
5. **Test endpoints**: Try the protected `/l5price` endpoint
6. **Verify response**: Check that you get data instead of 401 Unauthorized

This setup ensures that your API endpoints are properly protected and can be tested through the Swagger UI interface.
