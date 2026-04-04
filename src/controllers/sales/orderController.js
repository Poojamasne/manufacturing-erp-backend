const pool = require("../../config/database");

class OrderController {
  async createOrder(req, res) {
    try {
      const {
        quotation_id,
        customer_name,
        email,
        phone,
        shipping_address,
        items,
        notes,
      } = req.body;

      if (!customer_name || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Customer name and at least one item are required",
        });
      }

      const total_amount = items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0,
      );

      // Generate order ID
      const [lastOrder] = await pool.query(
        "SELECT order_id FROM orders ORDER BY id DESC LIMIT 1",
      );
      let orderId = "ORD-001";
      if (lastOrder.length > 0) {
        const num = parseInt(lastOrder[0].order_id.substring(4)) + 1;
        orderId = "ORD-" + num.toString().padStart(3, "0");
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const [result] = await connection.query(
          `INSERT INTO orders (order_id, quotation_id, customer_name, email, phone, 
                        shipping_address, total_amount, sales_rep_id, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            quotation_id || null,
            customer_name,
            email || null,
            phone || null,
            shipping_address || null,
            total_amount,
            req.user.id,
            notes || null,
          ],
        );

        // Insert items + production jobs
        for (const item of items) {
          // ✅ Insert into order_items
          await connection.query(
            `INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?)`,
            [
              result.insertId,
              item.product_name,
              item.quantity,
              item.unit_price,
              item.quantity * item.unit_price,
            ],
          );

          // 🔥 NEW: Insert into production_jobs (AUTO LINK)
          await connection.query(
            `INSERT INTO production_jobs 
        (job_id, order_id, product_name, quantity, status, stage, assigned_to)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              "PROD-" + Date.now(), // generate job id
              result.insertId, // ✅ link with order
              item.product_name,
              item.quantity,
              "Pending",
              "Pending",
              req.user.id, // assign user
            ],
          );
        }
        await connection.commit();

        res.status(201).json({
          success: true,
          message: "Order created successfully",
          data: { order_id: orderId, id: result.insertId },
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({
        success: false,
        message: "Error creating order",
        error: error.message,
      });
    }
  }

  async getAllOrders(req, res) {
    try {
      const { status, search, page = 1, limit = 10 } = req.query;

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

      query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

      const [orders] = await pool.query(query, params);

      const [countResult] = await pool.query(
        "SELECT COUNT(*) as total FROM orders",
      );

      res.status(200).json({
        success: true,
        data: orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching orders",
        error: error.message,
      });
    }
  }

  async getOrderById(req, res) {
    try {
      const { id } = req.params;

      const [orders] = await pool.query(
        `SELECT o.*, u.name as sales_rep_name
                 FROM orders o
                 LEFT JOIN users u ON o.sales_rep_id = u.id
                 WHERE o.id = ?`,
        [id],
      );

      if (orders.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      const [items] = await pool.query(
        "SELECT * FROM order_items WHERE order_id = ?",
        [id],
      );

      res.status(200).json({
        success: true,
        data: { ...orders[0], items },
      });
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching order",
        error: error.message,
      });
    }
  }

  async updateOrder(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = ["status", "shipping_address", "notes"];
      const updateFields = [];
      const params = [];

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          updateFields.push(`${field} = ?`);
          params.push(updates[field]);
        }
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No fields to update",
        });
      }

      params.push(id);
      await pool.query(
        `UPDATE orders SET ${updateFields.join(", ")}, updated_at = NOW() WHERE id = ?`,
        params,
      );

      res.status(200).json({
        success: true,
        message: "Order updated successfully",
      });
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).json({
        success: false,
        message: "Error updating order",
        error: error.message,
      });
    }
  }

  async deleteOrder(req, res) {
    try {
      const { id } = req.params;
      await pool.query("DELETE FROM orders WHERE id = ?", [id]);

      res.status(200).json({
        success: true,
        message: "Order deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting order:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting order",
        error: error.message,
      });
    }
  }
}

module.exports = new OrderController();
