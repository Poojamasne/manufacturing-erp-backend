# Manufacturing ERP - Lead Management APIs

**Base URL:** `http://localhost:5000/api/sales`

---

## 📋 Table of Contents
1. [Lead CRUD Operations](#lead-crud-operations)
2. [Lead Analytics & Reporting](#lead-analytics--reporting)
3. [Dashboard](#dashboard)
4. [Recommended Additional APIs](#recommended-additional-apis)
5. [Error Responses](#error-responses)

---

## Lead CRUD Operations

### 1. Create Lead
**POST** `/leads`

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
  "leadInfo": {
    "company_name": "ABC Manufacturing",
    "contact_person": "John Doe",
    "designation": "Director",
    "owner_name": "Sales Team",
    "phone_number": "+91-9876543210",
    "email_id": "john@abc.com",
    "gst_number": "27ADBGU7205R1Z0",
    "city": "Mumbai",
    "state": "Maharashtra",
    "lead_source": "Website",
    "priority": "High",
    "expected_decision_date": "2026-05-01",
    "follow_up_date": "2026-04-10",
    "address": "123 Business Park, Mumbai"
  },
  "products": [
    {
      "product_name": "Industrial Robotics Arm",
      "variant_model": "ARM-5000",
      "quantity": 2,
      "unit_approx": "pieces",
      "unit_price": 500000,
      "est_value": 1000000
    }
  ],
  "assignment": {
    "owner_name": "Sales Manager"
  },
  "leadDetails": {
    "notes": "Hot lead - Decision expected by May"
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Lead created successfully",
  "data": {
    "id": 1,
    "lead_id": "L001",
    "company_name": "ABC Manufacturing",
    "contact_person": "John Doe",
    "phone_number": "+91-9876543210",
    "email_id": "john@abc.com",
    "status": "New Lead",
    "created_at": "2026-04-02T10:30:00.000Z",
    "products": [...]
  }
}
```

---

### 2. Get All Leads
**GET** `/leads`

**Authentication:** Required (Bearer Token)

**Query Parameters:**
- `status` (optional) - 'New Lead', 'Contacted', 'Quotation', 'Converted', 'Won', 'Lost'
- `priority` (optional) - 'Low', 'Medium', 'High', 'Critical'
- `search` (optional) - Search by company name, contact person, email, or phone
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 10)

**Example:**
```
GET /leads?status=New Lead&priority=High&page=1&limit=10
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "lead_id": "L001",
      "company_name": "ABC Manufacturing",
      "contact_person": "John Doe",
      "phone_number": "+91-9876543210",
      "email_id": "john@abc.com",
      "city": "Mumbai",
      "state": "Maharashtra",
      "status": "New Lead",
      "priority": "High",
      "product_count": 2,
      "total_value": 1000000,
      "created_at": "2026-04-02T10:30:00.000Z"
    }
  ],
  "page": 1,
  "limit": 10
}
```

---

### 3. Get Single Lead
**GET** `/leads/:id`

**Authentication:** Required (Bearer Token)

**Example:**
```
GET /leads/1
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "lead_id": "L001",
    "company_name": "ABC Manufacturing",
    "contact_person": "John Doe",
    "designation": "Director",
    "owner_name": "Sales Team",
    "phone_number": "+91-9876543210",
    "email_id": "john@abc.com",
    "gst_number": "27ADBGU7205R1Z0",
    "city": "Mumbai",
    "state": "Maharashtra",
    "lead_source": "Website",
    "priority": "High",
    "status": "New Lead",
    "expected_decision_date": "2026-05-01",
    "follow_up_date": "2026-04-10",
    "address": "123 Business Park, Mumbai",
    "notes": "Hot lead - Decision expected by May",
    "product_count": 2,
    "total_value": 1000000,
    "products": [
      {
        "id": 1,
        "lead_id": 1,
        "product_name": "Industrial Robotics Arm",
        "variant_model": "ARM-5000",
        "quantity": 2,
        "unit_approx": "pieces",
        "est_value": 1000000
      }
    ],
    "created_at": "2026-04-02T10:30:00.000Z",
    "updated_at": "2026-04-02T10:30:00.000Z"
  }
}
```

---

### 4. Update Lead
**PUT** `/leads/:id`

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
  "company_name": "ABC Manufacturing Inc",
  "priority": "Critical",
  "status": "Contacted",
  "notes": "Customer contacted - scheduling demo"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Lead updated successfully"
}
```

---

### 5. Delete Lead
**DELETE** `/leads/:id`

**Authentication:** Required (Bearer Token)
**Authorization:** Admin or Manager role only

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Lead deleted successfully"
}
```

---

## Lead Analytics & Reporting

### 6. Lead Statistics
**GET** `/leads/statistics`

**Authentication:** Required (Bearer Token)

**Query Parameters:**
- `date_start` (optional) - Start date (YYYY-MM-DD)
- `date_end` (optional) - End date (YYYY-MM-DD)

**Example:**
```
GET /leads/statistics?date_start=2026-01-01&date_end=2026-04-02
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "total_leads": 45,
    "new_leads": 8,
    "contacted_leads": 12,
    "quotation": 10,
    "won_leads": 10,
    "lost_leads": 3,
    "converted_leads": 2,
    "avg_conversion_days": 28,
    "total_revenue": 25000000
  }
}
```

---

### 7. Pipeline Performance
**GET** `/leads/pipeline`

**Authentication:** Required (Bearer Token)

**Query Parameters:**
- `date_start` (optional) - Start date (YYYY-MM-DD)
- `date_end` (optional) - End date (YYYY-MM-DD)

**Example:**
```
GET /leads/pipeline?date_start=2026-01-01&date_end=2026-04-02
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "status": "New Lead",
      "count": 8,
      "high_priority": 3,
      "medium_priority": 4,
      "low_priority": 1,
      "critical_priority": 0,
      "avg_age_days": 12,
      "total_value": 2500000
    },
    {
      "status": "Contacted",
      "count": 12,
      "high_priority": 5,
      "medium_priority": 5,
      "low_priority": 2,
      "critical_priority": 0,
      "avg_age_days": 8,
      "total_value": 5000000
    },
    // ... more statuses
  ]
}
```

---

### 8. Sales by Category
**GET** `/leads/sales-by-category`

**Authentication:** Required (Bearer Token)

**Query Parameters:**
- `date_start` (optional) - Start date (YYYY-MM-DD)
- `date_end` (optional) - End date (YYYY-MM-DD)

**Example:**
```
GET /leads/sales-by-category?date_start=2026-01-01&date_end=2026-04-02
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "category": "Website",
      "lead_count": 15,
      "won_count": 5,
      "lost_count": 2,
      "total_revenue": 10000000
    },
    {
      "category": "Referral",
      "lead_count": 12,
      "won_count": 4,
      "lost_count": 1,
      "total_revenue": 8000000
    },
    // ... more categories
  ]
}
```

---

## Dashboard

### 9. Complete Dashboard Data
**GET** `/dashboard`

**Authentication:** Required (Bearer Token)

**Query Parameters:**
- `date_start` (optional) - Start date (YYYY-MM-DD)
- `date_end` (optional) - End date (YYYY-MM-DD)

**Example:**
```
GET /dashboard?date_start=2026-01-01&date_end=2026-04-02
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "stats": {
      "total_leads": 45,
      "new_leads": 8,
      "contacted_leads": 12,
      "quotation": 10,
      "won_leads": 10,
      "lost_leads": 3,
      "converted_leads": 2,
      "avg_conversion_days": 28,
      "total_revenue": 25000000
    },
    "pipeline": [
      // ... pipeline data
    ],
    "salesByCategory": [
      // ... category data
    ],
    "recentLeads": [
      {
        "id": 1,
        "lead_id": "L001",
        "company_name": "ABC Manufacturing",
        "contact_person": "John Doe",
        "phone_number": "+91-9876543210",
        "email_id": "john@abc.com",
        "status": "New Lead",
        "created_at": "2026-04-02T10:30:00.000Z"
      }
      // ... 5 most recent leads
    ]
  }
}
```

---

## Recommended Additional APIs

These APIs are commonly needed for modern lead management UIs but not yet implemented:

### Activity Tracking
```
POST   /leads/:id/activities        - Log activity (call, email, meeting)
GET    /leads/:id/activities        - Get activity timeline
```

### Notes/Comments
```
POST   /leads/:id/notes             - Add internal note
GET    /leads/:id/notes             - Get notes
PUT    /leads/:id/notes/:noteId     - Update note
DELETE /leads/:id/notes/:noteId     - Delete note
```

### Lead Assignment
```
PUT    /leads/:id/assign            - Reassign lead to user
GET    /user/leads                  - Get leads assigned to current user
```

### Bulk Operations
```
POST   /leads/bulk-update           - Update multiple leads
POST   /leads/bulk-delete           - Delete multiple leads
```

### Product Management
```
POST   /leads/:id/products          - Add product to lead
PUT    /leads/:id/products/:prodId  - Update product
DELETE /leads/:id/products/:prodId  - Delete product
```

### Follow-ups
```
POST   /leads/:id/followups         - Schedule follow-up
GET    /followups/pending           - Get pending follow-ups
PUT    /followups/:followupId       - Mark follow-up as done
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Company name is required"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Please provide a valid token"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "You don't have permission to delete leads"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Lead not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Error creating lead",
  "error": "Database error details"
}
```

---

## Authentication

All endpoints (except `/api/auth/login` and `/api/auth/signup`) require a Bearer token in the header:

```
Authorization: Bearer <your_jwt_token>
```

Example:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJzYWxlc21hbmFnZXJAZXJwLmNvbSIsInJvbGUiOiJtYW5hZ2VyIn0.4d31f7b9c8e8c9d8e8e8e8e8e8e8e8e8e8e8e8e8
```

---

## Testing the APIs

### Using Postman
1. Import `Postman_Collection.json`
2. Set Authorization token in Collection settings
3. Run requests against all endpoints

### Using cURL
```bash
# Login first to get token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"salesmanager@erp.com","password":"sales123"}'

# Use token in subsequent requests
curl -X GET http://localhost:5000/api/sales/leads \
  -H "Authorization: Bearer <your_token>"
```

### Using JavaScript/Fetch
```javascript
// Login
const loginResp = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'salesmanager@erp.com', password: 'sales123' })
});
const { data } = await loginResp.json();
const token = data.token;

// Get leads
const leadsResp = await fetch('http://localhost:5000/api/sales/leads', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const leads = await leadsResp.json();
console.log(leads);
```

---

## Environment Setup

### Test Credentials
```
Admin User
Email: admin@erp.com
Password: admin123

Sales Manager
Email: salesmanager@erp.com
Password: sales123

Sales Executive
Email: sales@erp.com
Password: sales@123
```

### Database
- Database: `manufacturing_erp`
- Tables: `leads`, `lead_products`, `sales_pipeline`, `users`

---

## Notes
- All timestamps are in ISO 8601 format
- Pagination uses 1-based indexing
- Dates should be in YYYY-MM-DD format
- Currency values are in decimal format (e.g., 1000000 = 10,00,000)
