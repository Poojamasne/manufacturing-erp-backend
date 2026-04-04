-- =====================================================
-- MANUFACTURING ERP - COMPLETE DATABASE SCHEMA
-- =====================================================

DROP DATABASE IF EXISTS manufacturing_erp;
CREATE DATABASE manufacturing_erp;
USE manufacturing_erp;

-- =====================================================
-- 1. USERS TABLE
-- =====================================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    designation VARCHAR(100),
    role ENUM('admin', 'manager', 'salesperson') DEFAULT 'salesperson',
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- =====================================================
-- 2. LEADS TABLE
-- =====================================================
CREATE TABLE leads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    lead_id VARCHAR(20) UNIQUE NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    gst_number VARCHAR(50),
    lead_source VARCHAR(50) DEFAULT 'Website',
    priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
    status ENUM('New', 'Contacted', 'Qualified', 'Quotation', 'Won', 'Lost') DEFAULT 'New',
    expected_close_date DATE,
    followup_date DATE,
    notes TEXT,
    assigned_to INT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_assigned_to (assigned_to)
);

-- =====================================================
-- 3. PRODUCTS TABLE
-- =====================================================
CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    price DECIMAL(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_name (name),
    INDEX idx_category (category)
);

-- =====================================================
-- 4. LEAD_PRODUCTS TABLE
-- =====================================================
CREATE TABLE lead_products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    lead_id INT NOT NULL,
    product_id INT,
    product_name VARCHAR(200) NOT NULL,
    variant VARCHAR(100),
    quantity INT DEFAULT 1,
    unit_price DECIMAL(12,2) DEFAULT 0,
    total_price DECIMAL(12,2) DEFAULT 0,
    
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    INDEX idx_lead_id (lead_id)
);

-- =====================================================
-- 5. OPPORTUNITIES TABLE
-- =====================================================
CREATE TABLE opportunities (
    id INT PRIMARY KEY AUTO_INCREMENT,
    opp_id VARCHAR(20) UNIQUE NOT NULL,
    lead_id INT,
    company_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    value DECIMAL(12,2) DEFAULT 0,
    stage ENUM('Discovery', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost') DEFAULT 'Discovery',
    priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
    source VARCHAR(50),
    expected_close_date DATE,
    assigned_to INT,
    notes TEXT,
    status ENUM('Active', 'Won', 'Lost') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_stage (stage),
    INDEX idx_status (status)
);

-- =====================================================
-- 6. QUOTATIONS TABLE
-- =====================================================
CREATE TABLE quotations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    quote_id VARCHAR(20) UNIQUE NOT NULL,
    opportunity_id INT,
    lead_id INT,
    company_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    quotation_date DATE DEFAULT CURDATE(),
    valid_until DATE,
    subtotal DECIMAL(12,2) DEFAULT 0,
    discount DECIMAL(12,2) DEFAULT 0,
    tax DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    status ENUM('Draft', 'Sent', 'Accepted', 'Rejected') DEFAULT 'Draft',
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE SET NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status)
);

-- =====================================================
-- 7. QUOTATION_ITEMS TABLE
-- =====================================================
CREATE TABLE quotation_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    quotation_id INT NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(12,2) DEFAULT 0,
    total_price DECIMAL(12,2) DEFAULT 0,
    
    FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
    INDEX idx_quotation_id (quotation_id)
);

-- =====================================================
-- 8. ORDERS TABLE
-- =====================================================
CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id VARCHAR(20) UNIQUE NOT NULL,
    quotation_id INT,
    customer_name VARCHAR(200) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    shipping_address TEXT,
    order_date DATE DEFAULT CURDATE(),
    total_amount DECIMAL(12,2) DEFAULT 0,
    status ENUM('Pending', 'Processing', 'Delivered', 'Cancelled') DEFAULT 'Pending',
    sales_rep_id INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL,
    FOREIGN KEY (sales_rep_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_order_date (order_date)
);

-- =====================================================
-- 9. ORDER_ITEMS TABLE
-- =====================================================
CREATE TABLE order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(12,2) DEFAULT 0,
    total_price DECIMAL(12,2) DEFAULT 0,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id)
);

-- =====================================================
-- 10. PRODUCTION_JOBS TABLE
-- =====================================================
CREATE TABLE production_jobs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    job_id VARCHAR(20) UNIQUE NOT NULL,
    order_id INT,
    product_name VARCHAR(200) NOT NULL,
    quantity INT DEFAULT 1,
    stage VARCHAR(50) DEFAULT 'Pending',
    status ENUM('Pending', 'In Progress', 'Completed', 'Delayed') DEFAULT 'Pending',
    started_at DATE,
    completed_at DATE,
    assigned_to INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status)
);

-- =====================================================
-- SAMPLE DATA
-- =====================================================

-- Insert Users (Password: password123 - will be hashed by backend)
INSERT INTO users (user_id, name, email, password, designation, role, phone) VALUES
('ADMIN', 'Admin User', 'admin@erp.com', 'password123', 'Administrator', 'admin', '9999999999'),
('SM001', 'Rahul Deshpande', 'rahul@erp.com', 'password123', 'Sales Manager', 'manager', '9823411223'),
('SP001', 'Sneha Patil', 'sneha@erp.com', 'password123', 'Sales Executive', 'salesperson', '9823456789');

-- Insert Products
INSERT INTO products (name, category, price) VALUES
('Double Door Refrigerator', 'Refrigerator', 35000),
('1.5 Ton Split AC', 'Air Conditioner', 40000),
('Front Load Washing Machine', 'Washing Machine', 38000),
('Convection Microwave', 'Microwave', 25000),
('Water Heater 25L', 'Water Heater', 8000);

-- Insert Sample Leads
INSERT INTO leads (lead_id, company_name, contact_person, phone, email, city, lead_source, priority, status, expected_close_date, assigned_to, created_by) VALUES
('L001', 'Rajesh Electronics', 'Rakesh Patil', '9869226825', 'rajesh@electro.com', 'Mumbai', 'Website', 'High', 'Won', '2024-04-15', 2, 2),
('L002', 'Modern Appliances', 'Rohit Sharma', '9869226826', 'modern@appl.com', 'Pune', 'Referral', 'Medium', 'Qualified', '2024-04-20', 3, 2),
('L003', 'Home Comfort', 'Lokesh Pathe', '9869226827', 'home@comfort.com', 'Nagpur', 'Cold Call', 'High', 'Quotation', '2024-04-10', 2, 2);

-- Insert Lead Products
INSERT INTO lead_products (lead_id, product_id, product_name, variant, quantity, unit_price, total_price) VALUES
(1, 1, 'Double Door Refrigerator', '500L', 5, 35000, 175000),
(1, 2, '1.5 Ton Split AC', 'Inverter', 3, 40000, 120000),
(2, 3, 'Front Load Washing Machine', '7kg', 2, 38000, 76000);

-- Insert Opportunities
INSERT INTO opportunities (opp_id, lead_id, company_name, value, stage, priority, expected_close_date, assigned_to, status) VALUES
('OP001', 1, 'Rajesh Electronics', 295000, 'Closed Won', 'High', '2024-03-31', 2, 'Won'),
('OP002', 2, 'Modern Appliances', 76000, 'Negotiation', 'Medium', '2024-04-15', 3, 'Active');

-- Insert Quotations
INSERT INTO quotations (quote_id, opportunity_id, lead_id, company_name, valid_until, subtotal, discount, tax, total, status, created_by) VALUES
('QT-001', 1, 1, 'Rajesh Electronics', '2024-04-20', 295000, 5000, 52200, 342200, 'Accepted', 2),
('QT-002', 2, 2, 'Modern Appliances', '2024-04-21', 76000, 2000, 13320, 87320, 'Sent', 3);

-- Insert Quotation Items
INSERT INTO quotation_items (quotation_id, product_name, quantity, unit_price, total_price) VALUES
(1, 'Double Door Refrigerator', 5, 35000, 175000),
(1, '1.5 Ton Split AC', 3, 40000, 120000),
(2, 'Front Load Washing Machine', 2, 38000, 76000);

-- Insert Orders
INSERT INTO orders (order_id, quotation_id, customer_name, email, phone, shipping_address, total_amount, status, sales_rep_id) VALUES
('ORD-001', 1, 'Rajesh Electronics', 'rajesh@electro.com', '9869226825', 'Industrial Estate Road, Mumbai', 342200, 'Processing', 2),
('ORD-002', 2, 'Modern Appliances', 'modern@appl.com', '9869226826', 'MG Road, Pune', 87320, 'Pending', 3);

-- Insert Order Items
INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price) VALUES
(1, 'Double Door Refrigerator', 5, 35000, 175000),
(1, '1.5 Ton Split AC', 3, 40000, 120000),
(2, 'Front Load Washing Machine', 2, 38000, 76000);

-- Insert Production Jobs
INSERT INTO production_jobs (job_id, order_id, product_name, quantity, stage, status, assigned_to) VALUES
('PROD-001', 1, 'Double Door Refrigerator', 5, 'Assembly', 'In Progress', 1),
('PROD-002', 1, '1.5 Ton Split AC', 3, 'Cutting', 'In Progress', 1),
('PROD-003', 2, 'Front Load Washing Machine', 2, 'Raw Materials', 'Pending', 1);

-- Verify Setup
SELECT 'Database Setup Complete!' as Status;
SELECT COUNT(*) as Total_Users FROM users;
SELECT COUNT(*) as Total_Leads FROM leads;
SELECT COUNT(*) as Total_Products FROM products;