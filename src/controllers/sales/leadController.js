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
            let productId = product.product_id || null;
            let variantId = product.variant_id || null;
            let productName = product.product_name;
            let variantName = product.variant;
            let unitPrice = product.unit_price;
            let quantity = product.quantity;

            // If product_id is provided, fetch product details
            if (productId) {
              const [existingProduct] = await connection.query(
                "SELECT name, price FROM products WHERE id = ? AND is_active = 1",
                [productId],
              );

              if (existingProduct.length > 0) {
                productName = existingProduct[0].name;
                if (!unitPrice || unitPrice === 0) {
                  unitPrice = existingProduct[0].price;
                }
              } else {
                await connection.rollback();
                return res.status(400).json({
                  success: false,
                  message: `Product with ID ${productId} not found or inactive`,
                });
              }
            }

            // If variant_id is provided, fetch variant details from lead_products
            if (variantId) {
              const [existingVariant] = await connection.query(
                `SELECT variant, unit_price, product_id 
                             FROM lead_products 
                             WHERE id = ?`,
                [variantId],
              );

              if (existingVariant.length > 0) {
                variantName = existingVariant[0].variant;
                if (!unitPrice || unitPrice === 0) {
                  unitPrice = existingVariant[0].unit_price;
                }
                if (!productId) {
                  productId = existingVariant[0].product_id;
                }
              } else {
                await connection.rollback();
                return res.status(400).json({
                  success: false,
                  message: `Variant with ID ${variantId} not found`,
                });
              }
            }

            // Validate required fields
            if (!productName) {
              await connection.rollback();
              return res.status(400).json({
                success: false,
                message: "Product name is required for each product",
              });
            }

            if (!quantity || quantity <= 0) {
              await connection.rollback();
              return res.status(400).json({
                success: false,
                message: "Valid quantity is required for each product",
              });
            }

            if (!unitPrice || unitPrice <= 0) {
              await connection.rollback();
              return res.status(400).json({
                success: false,
                message: "Valid unit price is required for each product",
              });
            }

            await connection.query(
              `INSERT INTO lead_products (lead_id, product_id, product_name, variant, 
                                            quantity, unit_price, total_price)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                result.insertId,
                productId,
                productName,
                variantName || null,
                quantity,
                unitPrice,
                quantity * unitPrice,
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
            status,
            expected_close_date,
            followup_date,
            notes,
            assigned_to,
            products,
        } = req.body;

        // Check if lead exists
        const [existingLead] = await pool.query(
            "SELECT id FROM leads WHERE id = ?",
            [id]
        );

        if (existingLead.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Lead not found",
            });
        }

        // Validate required fields
        if (!company_name || !phone) {
            return res.status(400).json({
                success: false,
                message: "Company name and phone are required",
            });
        }

        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // Update lead information - INCLUDING STATUS field
            await connection.query(
                `UPDATE leads SET 
                    company_name = ?,
                    contact_person = ?,
                    phone = ?,
                    email = ?,
                    address = ?,
                    city = ?,
                    state = ?,
                    gst_number = ?,
                    lead_source = ?,
                    priority = ?,
                    status = ?,
                    expected_close_date = ?,
                    followup_date = ?,
                    notes = ?,
                    assigned_to = ?,
                    updated_at = NOW()
                WHERE id = ?`,
                [
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
                    status || 'New',  // Use provided status or default to 'New'
                    expected_close_date,
                    followup_date,
                    notes,
                    assigned_to || req.user.id,
                    id,
                ],
            );

            // Delete existing products for this lead
            await connection.query("DELETE FROM lead_products WHERE lead_id = ?", [id]);

            // Insert products if any
            if (products && products.length > 0) {
                for (const product of products) {
                    let productId = product.product_id || null;
                    let variantId = product.variant_id || null;
                    let productName = product.product_name;
                    let variantName = product.variant;
                    let unitPrice = product.unit_price;
                    let quantity = product.quantity;

                    // If product_id is provided, fetch product details
                    if (productId) {
                        const [existingProduct] = await connection.query(
                            "SELECT name, price FROM products WHERE id = ? AND is_active = 1",
                            [productId]
                        );

                        if (existingProduct.length > 0) {
                            productName = existingProduct[0].name;
                            if (!unitPrice || unitPrice === 0) {
                                unitPrice = existingProduct[0].price;
                            }
                        } else {
                            await connection.rollback();
                            return res.status(400).json({
                                success: false,
                                message: `Product with ID ${productId} not found or inactive`,
                            });
                        }
                    }

                    // If variant_id is provided, fetch variant details from lead_products
                    if (variantId) {
                        const [existingVariant] = await connection.query(
                            `SELECT variant, unit_price, product_id 
                             FROM lead_products 
                             WHERE id = ?`,
                            [variantId]
                        );

                        if (existingVariant.length > 0) {
                            variantName = existingVariant[0].variant;
                            if (!unitPrice || unitPrice === 0) {
                                unitPrice = existingVariant[0].unit_price;
                            }
                            if (!productId) {
                                productId = existingVariant[0].product_id;
                            }
                        } else {
                            await connection.rollback();
                            return res.status(400).json({
                                success: false,
                                message: `Variant with ID ${variantId} not found`,
                            });
                        }
                    }

                    // Validate required fields
                    if (!productName) {
                        await connection.rollback();
                        return res.status(400).json({
                            success: false,
                            message: "Product name is required for each product",
                        });
                    }

                    if (!quantity || quantity <= 0) {
                        await connection.rollback();
                        return res.status(400).json({
                            success: false,
                            message: "Valid quantity is required for each product",
                        });
                    }

                    if (!unitPrice || unitPrice <= 0) {
                        await connection.rollback();
                        return res.status(400).json({
                            success: false,
                            message: "Valid unit price is required for each product",
                        });
                    }

                    await connection.query(
                        `INSERT INTO lead_products (lead_id, product_id, product_name, variant, 
                                            quantity, unit_price, total_price)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            id,
                            productId,
                            productName,
                            variantName || null,
                            quantity,
                            unitPrice,
                            quantity * unitPrice,
                        ]
                    );
                }
            }

            await connection.commit();

            // Fetch updated lead with products
            const [updatedLead] = await pool.query(
                `SELECT l.*, u.name as assigned_to_name
                 FROM leads l
                 LEFT JOIN users u ON l.assigned_to = u.id
                 WHERE l.id = ?`,
                [id]
            );

            const [updatedProducts] = await pool.query(
                "SELECT * FROM lead_products WHERE lead_id = ?",
                [id]
            );

            res.status(200).json({
                success: true,
                message: "Lead updated successfully",
                data: { ...updatedLead[0], products: updatedProducts },
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
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

      let productQuery = `
            SELECT 
                p.id as product_id,
                p.name as product_name,
                p.category,
                p.price as base_price,
                p.is_active,
                p.created_at
            FROM products p
            WHERE p.is_active = 1
        `;
      const productParams = [];

      // Search by product name or category
      if (search) {
        productQuery += ` AND (p.name LIKE ? OR p.category LIKE ?)`;
        productParams.push(`%${search}%`, `%${search}%`);
      }

      
      let countQuery =
        "SELECT COUNT(*) as total FROM products WHERE is_active = 1";
      const countParams = [];

      if (search) {
        countQuery += ` AND (name LIKE ? OR category LIKE ?)`;
        countParams.push(`%${search}%`, `%${search}%`);
      }
      const [countResult] = await pool.query(countQuery, countParams);

      const [products] = await pool.query(productQuery, productParams);

      // If no products found, return empty array
      if (products.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
        });
      }

      // Get all variants for these products
      const productIds = products.map((p) => p.product_id);
      const [variants] = await pool.query(
        `SELECT 
                lp.product_id,
                lp.id as variant_id,
                lp.variant as variant_name,
                lp.quantity,
                lp.unit_price,
                lp.total_price,
                l.lead_id,
                l.company_name,
                l.status
            FROM lead_products lp
            LEFT JOIN leads l ON lp.lead_id = l.id
            WHERE lp.product_id IN (?) AND lp.variant IS NOT NULL
            ORDER BY lp.product_id, lp.variant`,
        [productIds],
      );

      // Group variants by product_id
      const variantsByProduct = {};
      variants.forEach((variant) => {
        if (!variantsByProduct[variant.product_id]) {
          variantsByProduct[variant.product_id] = [];
        }
        variantsByProduct[variant.product_id].push({
          variant_id: variant.variant_id,
          variant_name: variant.variant_name,
          quantity: variant.quantity,
          unit_price: variant.unit_price,
          total_price: variant.total_price,
          lead_id: variant.lead_id,
          company_name: variant.company_name,
          status: variant.status,
        });
      });

      // Attach variants to products
      const productsWithVariants = products.map((product) => ({
        ...product,
        variants: variantsByProduct[product.product_id] || [],
      }));

      res.status(200).json({
        success: true,
        data: productsWithVariants,
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
