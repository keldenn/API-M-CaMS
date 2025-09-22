# Authentication API Testing Guide

## 🚀 Quick Start

Your NestJS API with advanced authentication is now ready! Here's how to test it:

### 1. **Access Swagger UI**
- URL: `http://localhost:3000/api`
- This provides interactive API documentation and testing interface

### 2. **Environment Setup**
Create a `.env` file in the root directory with:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_mysql_password
DB_DATABASE=cams_db
DB_SYNC=false
DB_LOGGING=false

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-make-it-long-and-random
JWT_EXPIRES_IN=24h

# Application Configuration
PORT=3000
NODE_ENV=development

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=10
LOGIN_ATTEMPTS_LIMIT=5
```

## 🔐 Authentication Testing

### **Step 1: Test Login API**

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "username": "your_username",
  "password": "your_password", 
  "VerificationAPI": "RSEB@2020"
}
```

**Success Response:**
```json
{
  "error": false,
  "message": "Login Successful",
  "data": {
    "cd_code": "CLIENT001",
    "name": "John Doe",
    "email": "john@example.com",
    "username": "john_doe",
    "broker_user_name": "broker_john",
    "participant_code": "PART001",
    "profilePicture": null,
    "isNRB": 0,
    "cid": "11234567890"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### **Step 2: Test Protected Routes**

**Endpoint:** `GET /`

**Headers Required:**
```
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

## 🧪 Testing Methods

### **Method 1: Using Swagger UI (Recommended)**

1. Go to `http://localhost:3000/api`
2. Find the `/auth/login` endpoint
3. Click "Try it out"
4. Enter your credentials:
   ```json
   {
     "username": "test_user",
     "password": "password123",
     "VerificationAPI": "RSEB@2020"
   }
   ```
5. Click "Execute"
6. Copy the `access_token` from the response
7. Click the "Authorize" button at the top of Swagger
8. Enter: `Bearer YOUR_ACCESS_TOKEN`
9. Now you can test protected endpoints!

### **Method 2: Using cURL**

**Login:**
```bash
curl -X POST "http://localhost:3000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "password": "password123",
    "VerificationAPI": "RSEB@2020"
  }'
```

**Access Protected Route:**
```bash
curl -X GET "http://localhost:3000/" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### **Method 3: Using Postman**

1. **Create Login Request:**
   - Method: POST
   - URL: `http://localhost:3000/auth/login`
   - Headers: `Content-Type: application/json`
   - Body (raw JSON):
   ```json
   {
     "username": "test_user",
     "password": "password123",
     "VerificationAPI": "RSEB@2020"
   }
   ```

2. **Save JWT Token:**
   - Copy `access_token` from response
   - Create environment variable `jwt_token`

3. **Test Protected Route:**
   - Method: GET
   - URL: `http://localhost:3000/`
   - Headers: `Authorization: Bearer {{jwt_token}}`

## 🛡️ Security Features Implemented

### **1. Rate Limiting**
- Login attempts limited to 5 per minute per IP
- Global rate limiting: 10 requests per minute
- Account lockout after 5 failed attempts per day

### **2. Password Security**
- Automatic bcrypt upgrade from MD5 (legacy support)
- Secure password hashing with salt rounds: 12
- Password verification with timing attack protection

### **3. JWT Security**
- Bearer token authentication
- Configurable expiration time
- Secure secret key (configure in .env)

### **4. Input Validation**
- Class-validator for DTO validation
- Whitelist and forbid non-whitelisted properties
- Transform and sanitize inputs

### **5. Database Security**
- Parameterized queries (SQL injection protection)
- Connection pooling
- Timezone handling (Asia/Thimphu)

## 🔍 Testing Scenarios

### **Scenario 1: Successful Login**
```json
Request: {
  "username": "valid_user",
  "password": "correct_password",
  "VerificationAPI": "RSEB@2020"
}
Expected: 200 OK with JWT token
```

### **Scenario 2: Invalid Credentials**
```json
Request: {
  "username": "invalid_user",
  "password": "wrong_password",
  "VerificationAPI": "RSEB@2020"
}
Expected: 200 OK with error: true, message: "Invalid Username or Password"
```

### **Scenario 3: Wrong API Key**
```json
Request: {
  "username": "valid_user",
  "password": "correct_password",
  "VerificationAPI": "WRONG_KEY"
}
Expected: 200 OK with error: true, message: "Unauthorized."
```

### **Scenario 4: Rate Limiting**
- Make 6 login requests within 1 minute
- Expected: 429 Too Many Requests

### **Scenario 5: Account Lockout**
- Make 5 failed login attempts for same user
- Expected: Account locked message

### **Scenario 6: Protected Route Without Token**
```bash
curl -X GET "http://localhost:3000/"
Expected: 401 Unauthorized
```

### **Scenario 7: Protected Route With Valid Token**
```bash
curl -X GET "http://localhost:3000/" \
  -H "Authorization: Bearer VALID_JWT_TOKEN"
Expected: 200 OK with authenticated response
```

## 📊 Database Setup

Make sure your MySQL database has these tables:

```sql
-- Users table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  is_bcrypt BOOLEAN DEFAULT TRUE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  cid VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(255),
  profilePicture VARCHAR(255),
  status INT DEFAULT 1,
  role_id INT NOT NULL,
  isNRB INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Link user table
CREATE TABLE linkuser (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_code VARCHAR(255) NOT NULL,
  participant_code VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  broker_user_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Login attempts table
CREATE TABLE login_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API log table
CREATE TABLE mobile_api_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATETIME NOT NULL,
  endpoint TEXT NOT NULL,
  user VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🚨 Troubleshooting

### **Common Issues:**

1. **Database Connection Error**
   - Check your `.env` file database credentials
   - Ensure MySQL is running
   - Verify database exists

2. **JWT Secret Error**
   - Make sure `JWT_SECRET` is set in `.env`
   - Use a long, random string (minimum 32 characters)

3. **Rate Limiting Too Strict**
   - Adjust `THROTTLE_LIMIT` and `THROTTLE_TTL` in `.env`
   - Restart the application

4. **CORS Issues**
   - CORS is enabled by default
   - Check browser console for errors

## 🎯 Next Steps

1. Set up your database with sample data
2. Configure your `.env` file
3. Test the login endpoint
4. Create additional protected routes
5. Implement role-based access control
6. Add more security middleware as needed

## 📝 API Documentation

Full interactive API documentation is available at:
`http://localhost:3000/api`

This includes:
- All endpoints with examples
- Request/response schemas
- Authentication testing interface
- Rate limiting information

Happy testing! 🚀
