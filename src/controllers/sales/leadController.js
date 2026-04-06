const pool = require("../../config/database");

class LeadController {
  async createLead(req, res) {
    try {
      const {
        company_name,
        contact_person,
        phone,
        email,
        address,
        city,
        state,
        gst_number,
        lead_source,
        priority,
        expected_close_date,
        followup_date,
        notes,
        assigned_to,
        products,
      } = req.body;

      if (!company_name || !phone) {
        return res.status(400).json({
          success: false,
          message: "Company name and phone are required",
        });
      }

      // Generate lead ID
      const [lastLead] = await pool.query(
        "SELECT lead_id FROM leads ORDER BY id DESC LIMIT 1",
      );
      let leadId = "L001";
      if (lastLead.length > 0) {
        const num = parseInt(lastLead[0].lead_id.substring(1)) + 1;
        leadId = "L" + num.toString().padStart(3, "0");
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const [result] = await connection.query(
          `INSERT INTO leads (lead_id, company_name, contact_person, phone, email, address, 
                        city, state, gst_number, lead_source, priority, expected_close_date, 
                        followup_date, notes, assigned_to, created_by, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New')`,
          [
            leadId,
            company_name,
            contact_person,
            phone,
            email,
            address,
            city,
            state,
            gst_number,
            lead_source,
            priority,
            expected_close_date,
            followup_date,
            notes,
            assigned_to || req.user.id,
            req.user.id,
          ],
        );

        // Insert products if any
        if (products && products.length > 0) {
          for (const product of products) {
            await connection.query(
              `INSERT INTO lead_products (lead_id, product_id, product_name, variant, 
                                quantity, unit_price, total_price)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                result.insertId,
                product.product_id || null,
                product.product_name,
                product.variant,
                product.quantity,
                product.unit_price,
                product.quantity * product.unit_price,
              ],
            );
          }
        }

        await connection.commit();

        res.status(201).json({
          success: true,
          message: "Lead created successfully",
          data: { lead_id: leadId, id: result.insertId },
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(500).json({
        success: false,
        message: "Error creating lead",
        error: error.message,
      });
    }
  }

  async getAllLeads(req, res) {
    try {
      const { status, priority, search, page = 1, limit = 10 } = req.query;

      let query = `
            SELECT l.*, u.name as assigned_to_name
            FROM leads l
            LEFT JOIN users u ON l.assigned_to = u.id
            WHERE 1=1
        `;
      const params = [];

      if (status && status !== "All") {
        query += ` AND l.status = ?`;
        params.push(status);
      }
      if (priority && priority !== "All") {
        query += ` AND l.priority = ?`;
        params.push(priority);
      }
      if (search) {
        query += ` AND (l.company_name LIKE ? OR l.lead_id LIKE ? OR l.phone LIKE ?)`;
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      query += ` ORDER BY l.created_at DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

      const [leads] = await pool.query(query, params);

      // Get total count for pagination
      let countQuery = "SELECT COUNT(*) as total FROM leads WHERE 1=1";
      const countParams = [];

      if (status && status !== "All") {
        countQuery += ` AND status = ?`;
        countParams.push(status);
      }
      if (priority && priority !== "All") {
        countQuery += ` AND priority = ?`;
        countParams.push(priority);
      }
      if (search) {
        countQuery += ` AND (company_name LIKE ? OR lead_id LIKE ? OR phone LIKE ?)`;
        const searchTerm = `%${search}%`;
        countParams.push(searchTerm, searchTerm, searchTerm);
      }

      const [countResult] = await pool.query(countQuery, countParams);

      // Fetch products for all leads with complete product details
      if (leads.length > 0) {
        const leadIds = leads.map((lead) => lead.id);
        const [allProducts] = await pool.query(
          `SELECT lp.*, p.name as product_name_from_db, p.category, p.price as original_price
                 FROM lead_products lp
                 LEFT JOIN products p ON lp.product_id = p.id
                 WHERE lp.lead_id IN (?)`,
          [leadIds],
        );

        // Group products by lead_id
        const productsByLead = {};
        allProducts.forEach((product) => {
          if (!productsByLead[product.lead_id]) {
            productsByLead[product.lead_id] = [];
          }
          // Format product data
          productsByLead[product.lead_id].push({
            id: product.id,
            product_id: product.product_id,
            product_name: product.product_name || product.product_name_from_db,
            variant: product.variant,
            quantity: product.quantity,
            unit_price: product.unit_price,
            total_price: product.total_price,
            category: product.category,
            original_price: product.original_price,
          });
        });

        // Attach products to each lead
        leads.forEach((lead) => {
          lead.products = productsByLead[lead.id] || [];
        });
      }

      res.status(200).json({
        success: true,
        data: leads,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching leads",
        error: error.message,
      });
    }
  }

  async getLeadById(req, res) {
    try {
      const { id } = req.params;

      const [leads] = await pool.query(
        `SELECT l.*, u.name as assigned_to_name
                 FROM leads l
                 LEFT JOIN users u ON l.assigned_to = u.id
                 WHERE l.id = ?`,
        [id],
      );

      if (leads.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Lead not found",
        });
      }

      const [products] = await pool.query(
        "SELECT * FROM lead_products WHERE lead_id = ?",
        [id],
      );

      res.status(200).json({
        success: true,
        data: { ...leads[0], products },
      });
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching lead",
        error: error.message,
      });
    }
  }

  async updateLead(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        "company_name",
        "contact_person",
        "phone",
        "email",
        "address",
        "city",
        "state",
        "priority",
        "status",
        "expected_close_date",
        "followup_date",
        "notes",
        "assigned_to",
      ];

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
        `UPDATE leads SET ${updateFields.join(", ")}, updated_at = NOW() WHERE id = ?`,
        params,
      );

      res.status(200).json({
        success: true,
        message: "Lead updated successfully",
      });
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(500).json({
        success: false,
        message: "Error updating lead",
        error: error.message,
      });
    }
  }

  async deleteLead(req, res) {
    try {
      const { id } = req.params;
      await pool.query("DELETE FROM leads WHERE id = ?", [id]);

      res.status(200).json({
        success: true,
        message: "Lead deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting lead:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting lead",
        error: error.message,
      });
    }
  }

  async getAllProducts(req, res) {
    try {
      const { search, page = 1, limit = 50 } = req.query;

      let query = `
            SELECT id, name, category, price, created_at
            FROM products
            WHERE 1=1
        `;
      const params = [];

      // Search by name or category
      if (search) {
        query += ` AND (name LIKE ? OR category LIKE ?)`;
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
      }

      // Get total count for pagination
      let countQuery = "SELECT COUNT(*) as total FROM products WHERE 1=1";
      const countParams = [];

      if (search) {
        countQuery += ` AND (name LIKE ? OR category LIKE ?)`;
        countParams.push(`%${search}%`, `%${search}%`);
      }

      const [countResult] = await pool.query(countQuery, countParams);

      // Add pagination
      query += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

      const [products] = await pool.query(query, params);

      res.status(200).json({
        success: true,
        data: products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching products",
        error: error.message,
      });
    }
  }
}

module.exports = new LeadController();
