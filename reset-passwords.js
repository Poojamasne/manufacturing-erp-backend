const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function resetPasswords() {
  let connection;
  try {
    console.log("Starting password reset...\n");

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
    });

    console.log("Connected to MySQL\n");

    // Delete all existing employees
    console.log(" Clearing existing employee data...");
    await connection.query("DELETE FROM employees");
    console.log(" All employees deleted\n");

    // Test data with passwords
    const testUsers = [
      {
        employee_id: "EMP001",
        name: "Admin User",
        email: "admin@erp.com",
        password: "admin123",
        designation: "System Administrator",
        role: "admin",
        phone: "+91-9876543210",
      },
      {
        employee_id: "EMP002",
        name: "Sales Manager",
        email: "manager@erp.com",
        password: "manager123",
        designation: "Sales Manager",
        role: "manager",
        phone: "+91-9876543211",
      },
      {
        employee_id: "SM001",
        name: "Sales Manager",
        email: "salesmanager@erp.com",
        password: "sales123",
        designation: "Sales Manager",
        role: "manager",
        phone: "+91-9876543210",
      },
      {
        employee_id: "EMP003",
        name: "Sales Executive",
        email: "sales@erp.com",
        password: "sales@123",
        designation: "Sales Executive",
        role: "salesperson",
        phone: "+91-9876543212",
      },
    ];

    console.log(" Creating users with proper password hashing...\n");

    // Hash passwords and insert users
    for (const user of testUsers) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(user.password, salt);

      await connection.query(
        `INSERT INTO employees (employee_id, name, email, password, designation, role, phone, is_active) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.employee_id,
          user.name,
          user.email,
          hashedPassword,
          user.designation,
          user.role,
          user.phone,
          1,
        ],
      );

      console.log(`   User created: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Hashed: ${hashedPassword}\n`);
    }

    const [rows] = await connection.query(
      "SELECT id, employee_id, name, email, designation, role, is_active FROM employees",
    );

    console.log("\n" + "=".repeat(80));
    console.log(" ALL USERS IN DATABASE:");
    console.log("=".repeat(80));
    rows.forEach((user) => {
      console.log(` ID: ${user.id}
                    Employee ID: ${user.employee_id}
                    Name: ${user.name}
                    Email: ${user.email}
                    Designation: ${user.designation}
                    Role: ${user.role}
                    Status: ${user.is_active ? "Active" : "Inactive"}---`);
    });

    console.log("\n" + "=".repeat(80));
    console.log(" TEST CREDENTIALS:");
    console.log("=".repeat(80));
    console.log(`
Admin User:
  Email: admin@erp.com
  Password: admin123

Manager:
  Email: manager@erp.com
  Password: manager123

Sales Manager:
  Email: salesmanager@erp.com
  Password: sales123

Sales Executive:
  Email: sales@erp.com
  Password: sales@123
`);
    console.log("=".repeat(80));
    console.log(" Password reset completed successfully!");
    console.log(" Test login at: POST http://localhost:5000/api/auth/login");
    console.log("=".repeat(80));

    await connection.end();
  } catch (error) {
    console.error(" Password reset failed:", error.message);
    process.exit(1);
  }
}

resetPasswords();
