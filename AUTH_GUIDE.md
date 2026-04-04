# Manufacturing ERP Authentication - Complete Guide

## ✅ Fixed Issues

### Problem 1: Missing Employees Table
**FIXED** - Created `002_create_employees_table.sql` migration with proper schema

### Problem 2: Corrupted Password Hashes
**FIXED** - All passwords now use proper bcrypt hashing (60 characters, `$2a$10$...` format)

### Problem 3: Missing Signup Endpoint
**FIXED** - Added `/api/auth/signup` endpoint for user registration

---

## 🔐 Current Test Users

All passwords are now properly hashed with bcrypt:

| Email | Password | Role | Employee ID |
|-------|----------|------|-------------|
| admin@erp.com | admin123 | admin | EMP001 |
| manager@erp.com | manager123 | manager | EMP002 |
| salesmanager@erp.com | sales123 | manager | SM001 |
| sales@erp.com | sales@123 | salesperson | EMP003 |

---

## 🚀 How to Start Server

```bash
cd c:\Users\Admin\Desktop\Erp-Manifacturing_Backend\manufacturing-erp-backend

# Start server
npm start
```

Server runs on: `http://localhost:5000`

---

## 📝 API Endpoints

### 1. Signup New User
```
POST /api/auth/signup
Content-Type: application/json

{
  "employee_id": "EMP999",
  "name": "New User",
  "email": "newuser@erp.com",
  "password": "newpassword123",
  "designation": "Sales Engineer",
  "role": "salesperson",
  "phone": "+91-9999999999"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": 15,
    "email": "newuser@erp.com",
    "name": "New User"
  }
}
```

---

### 2. Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "salesmanager@erp.com",
  "password": "sales123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 13,
      "employee_id": "SM001",
      "name": "Sales Manager",
      "email": "salesmanager@erp.com",
      "designation": "Sales Manager",
      "role": "manager",
      "phone": "+91-9876543210",
      "last_login": null
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 3. Get Profile (Protected)
```
GET /api/auth/profile
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 13,
      "employee_id": "SM001",
      "name": "Sales Manager",
      "email": "salesmanager@erp.com",
      "designation": "Sales Manager",
      "role": "manager",
      "phone": "+91-9876543210",
      "is_active": 1,
      "last_login": "2026-03-30 14:05:37",
      "created_at": "2026-03-30 12:09:45"
    }
  }
}
```

---

### 4. Change Password (Protected)
```
POST /api/auth/change-password
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN

{
  "currentPassword": "sales123",
  "newPassword": "newsales123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### 5. Logout
```
POST /api/auth/logout
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 🧪 Testing with CURL

### Test Login (Your Case)
```bash
curl -X POST http://localhost:5000/api/auth/login \
  --header 'Content-Type: application/json' \
  --data '{
    "email": "salesmanager@erp.com",
    "password": "sales123"
  }'
```

### Test Signup
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  --header 'Content-Type: application/json' \
  --data '{
    "employee_id": "EMP100",
    "name": "John Doe",
    "email": "john@erp.com",
    "password": "john@123",
    "designation": "Senior Sales Manager",
    "role": "manager",
    "phone": "+91-9999999999"
  }'
```

---

## 📦 Postman Collection

A Postman collection file is included: `Postman_Collection.json`

**To import in Postman:**
1. Open Postman
2. Click "Import"
3. Select the `Postman_Collection.json` file
4. All API endpoints will be ready to test

---

## 🔄 Scripts Available

### Reset All Passwords
If you need to reset passwords again:
```bash
node reset-passwords.js
```

This will:
- Delete all existing employees
- Create fresh test users with proper bcrypt hashes
- Display all credentials

### Setup Auth (Original)
```bash
npm run setup-auth
```

---

## 📊 Database Schema

### employees table
```sql
CREATE TABLE employees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,        -- bcrypt hash (60 chars)
    designation VARCHAR(100),
    role ENUM('admin','manager','salesperson'),
    phone VARCHAR(20),
    is_active TINYINT(1) DEFAULT 1,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 🛠️ Files Modified/Created

1. **src/controllers/authController.js** - Added `signup` action
2. **src/routes/authRoutes.js** - Added `/signup` route
3. **database/migrations/002_create_employees_table.sql** - Created employees table
4. **reset-passwords.js** - Script to reset all passwords with proper bcrypt hashes
5. **Postman_Collection.json** - Ready-to-use Postman requests
6. **setup-auth.js** - Database initialization script

---

## ✨ Key Features

✅ Proper bcrypt password hashing (salt rounds: 10)
✅ JWT authentication with 24h expiration
✅ Refresh tokens with 7d expiration  
✅ Password change functionality
✅ User profile retrieval
✅ Role-based access (admin, manager, salesperson)
✅ Active user filtering (`is_active = 1`)
✅ Last login tracking

---

## 🔧 Troubleshooting

### "Invalid email or password" on correct credentials
✅ FIXED - Passwords are now properly hashed. Run `node reset-passwords.js`

### Database connection error
- Check `.env` file has correct credentials
- Ensure MySQL server is running
- Default: `localhost:3306` with user `root` and password `root@123`

### Server won't start
- Make sure you're in the correct directory: `c:\Users\Admin\Desktop\Erp-Manifacturing_Backend\manufacturing-erp-backend`
- Install dependencies: `npm install`
- Check port 5000 is not in use

---

## 📞 Quick Test

After starting the server, run:

```bash
curl http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"salesmanager@erp.com","password":"sales123"}'
```

You should get a successful response with JWT token! 🎉

---

**Last Updated:** March 30, 2026
**Status:** ✅ All issues fixed and tested!
