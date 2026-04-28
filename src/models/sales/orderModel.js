const pool = require("../../config/database");

class OrderModel {

    async generateOrderId() {
        const [lastOrder] = await pool.query(
            "SELECT order_id FROM orders ORDER BY id DESC LIMIT 1"
        );
        let orderId = "ORD-001";
        if (lastOrder.length > 0) {
            const num = parseInt(lastOrder[0].order_id.substring(4)) + 1;
            orderId = "ORD-" + num.toString().padStart(3, "0");
        }
        return orderId;
    }


    async createOrderWithTransaction(orderData, items, userId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.query(
                `INSERT INTO orders (order_id, quotation_id, customer_name, email, phone, 
                            shipping_address, total_amount, sales_rep_id, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderData.orderId,
                    orderData.quotation_id || null,
                    orderData.customer_name,
                    orderData.email || null,
                    orderData.phone || null,
                    orderData.shipping_address || null,
                    orderData.total_amount,
                    userId,
                    orderData.notes || null,
                ]
            );

            // Insert items + production jobs
            for (const item of items) {
                // Insert into order_items
                await connection.query(
                    `INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        result.insertId,
                        item.product_name,
                        item.quantity,
                        item.unit_price,
                        item.quantity * item.unit_price,
                    ]
                );

            
                await connection.query(
                    `INSERT INTO production_jobs 
                     (job_id, order_id, product_name, quantity, status, stage, assigned_to)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        "PROD-" + Date.now(),
                        result.insertId,
                        item.product_name,
                        item.quantity,
                        "Pending",
                        "Pending",
                        userId,
                    ]
                );
            }
            
            await connection.commit();
            return { orderId: orderData.orderId, insertId: result.insertId };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    
    async getAllOrders(status, search, page, limit, dateRange, startDate, endDate) {
        let query = `
            SELECT o.*, u.name as sales_rep_name,
                   (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
            FROM orders o
            LEFT JOIN users u ON o.sales_rep_id = u.id
            WHERE 1=1
        `;
        const params = [];

        
        if (status && status !== "All") {
            query += ` AND o.status = ?`;
            params.push(status);
        }
        
        
        if (search) {
            query += ` AND (o.customer_name LIKE ? OR o.order_id LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }
        
        // Date range filters
        if (dateRange === 'Weekly') {
            query += ` AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
        } else if (dateRange === 'Monthly') {
            query += ` AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
        } else if (dateRange === 'Quarterly') {
            query += ` AND o.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
        } else if (dateRange === 'Yearly') {
            query += ` AND o.created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
        } else if (dateRange === 'Custom' && startDate && endDate) {
            query += ` AND DATE(o.created_at) BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        const parsedPage = parseInt(page) || 1;
        const parsedLimit = parseInt(limit) || 10;
        const offset = (parsedPage - 1) * parsedLimit;
        
        query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parsedLimit, offset);

        const [orders] = await pool.query(query, params);
        return { orders, parsedPage, parsedLimit };
    }


    async getOrdersCount(status, search, dateRange, startDate, endDate) {
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM orders o
            WHERE 1=1
        `;
        
        let countQueryParams = [];
        
        if (status && status !== "All") {
            countQuery += ` AND o.status = ?`;
            countQueryParams.push(status);
        }
        if (search) {
            countQuery += ` AND (o.customer_name LIKE ? OR o.order_id LIKE ?)`;
            const searchTerm = `%${search}%`;
            countQueryParams.push(searchTerm, searchTerm);
        }
        if (dateRange === 'Weekly') {
            countQuery += ` AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
        } else if (dateRange === 'Monthly') {
            countQuery += ` AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
        } else if (dateRange === 'Quarterly') {
            countQuery += ` AND o.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
        } else if (dateRange === 'Yearly') {
            countQuery += ` AND o.created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
        } else if (dateRange === 'Custom' && startDate && endDate) {
            countQuery += ` AND DATE(o.created_at) BETWEEN ? AND ?`;
            countQueryParams.push(startDate, endDate);
        }
        
        const [countResult] = await pool.query(countQuery, countQueryParams);
        return countResult[0]?.total || 0;
    }

    
    async getOrderById(id) {
        const [orders] = await pool.query(
            `SELECT o.*, u.name as sales_rep_name
             FROM orders o
             LEFT JOIN users u ON o.sales_rep_id = u.id
             WHERE o.id = ?`,
            [id]
        );
        return orders[0];
    }


    async getOrderItems(orderId) {
        const [items] = await pool.query(
            "SELECT * FROM order_items WHERE order_id = ?",
            [orderId]
        );
        return items;
    }

   
    async checkOrderExists(id) {
        const [existing] = await pool.query('SELECT id FROM orders WHERE id = ?', [id]);
        return existing.length > 0;
    }

   
    async updateOrder(id, updateFields, params) {
        params.push(id);
        await pool.query(
            `UPDATE orders SET ${updateFields.join(", ")}, updated_at = NOW() WHERE id = ?`,
            params
        );
    }


    async deleteOrder(id) {
        await pool.query("DELETE FROM orders WHERE id = ?", [id]);
    }
}

module.exports = OrderModel;