CREATE DATABASE IF NOT EXISTS manufacturing_erp;
USE manufacturing_erp;

CREATE TABLE IF NOT EXISTS leads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    lead_id VARCHAR(20) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255) NOT NULL,
    designation VARCHAR(100),
    owner_name VARCHAR(255),
    phone_number VARCHAR(20) NOT NULL,
    email_id VARCHAR(255),
    gst_number VARCHAR(50),
    city VARCHAR(100),
    state VARCHAR(100),
    lead_source VARCHAR(100),
    priority ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Medium',
    expected_decision_date DATE,
    follow_up_date DATE,
    initial_status VARCHAR(50) DEFAULT 'New Lead',
    address TEXT,
    notes TEXT,
    status ENUM('New Lead', 'Contacted', 'Converted', 'Quotation', 'Won', 'Lost') DEFAULT 'New Lead',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_lead_id (lead_id),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS lead_products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    lead_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    variant_model VARCHAR(255),
    quantity INT NOT NULL,
    unit_approx VARCHAR(50),
    est_value DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    INDEX idx_lead_id (lead_id)
);

CREATE TABLE IF NOT EXISTS sales_pipeline (
    id INT PRIMARY KEY AUTO_INCREMENT,
    lead_id INT NOT NULL,
    stage VARCHAR(50) NOT NULL,
    stage_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    INDEX idx_lead_id (lead_id),
    INDEX idx_stage (stage)
);
