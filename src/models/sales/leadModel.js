const pool = require("../../config/database");

class LeadModel {

    async createLeadWithTransaction(leadData, products, userId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.query(
                `INSERT INTO leads (
                    company_name, contact_person, phone, email, address, 
                    city, state, gst_number, lead_source, priority, 
                    expected_close_date, followup_date, notes, 
                    assigned_to, created_by, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New')`,
                [
                    leadData.company_name,
                    leadData.contact_person,
                    leadData.phone,
                    leadData.email,
                    leadData.address,
                    leadData.city,
                    leadData.state,
                    leadData.gst_number,
                    leadData.lead_source,
                    leadData.priority,
                    leadData.expected_close_date,
                    leadData.followup_date,
                    leadData.notes,
                    leadData.assigned_to || userId,
                    userId,
                ]
            );

            const leadId = `LD-${String(result.insertId).padStart(3, '0')}`;
            
           
            await connection.query(
                "UPDATE leads SET lead_id = ? WHERE id = ?",
                [leadId, result.insertId]
            );

            if (products && products.length > 0) {
                for (const product of products) {
                    let productId = product.product_id || null;
                    let productName = product.product_name;
                    let variantName = product.variant || null;
                    let unitPrice = product.unit_price;
                    let quantity = product.quantity;

                    
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
                        }
                    }

                    await connection.query(
                        `INSERT INTO lead_products (
                            lead_id, product_id, product_name, variant, 
                            quantity, unit_price, total_price
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            result.insertId,
                            productId,
                            productName,
                            variantName,
                            quantity,
                            unitPrice,
                            quantity * unitPrice,
                        ]
                    );
                }
            }

            await connection.commit();
            return { leadId, insertId: result.insertId };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Get all leads with filters
    async getAllLeads(status, priority, search, page, limit) {
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
        return leads;
    }


    async getLeadsCount(status, priority, search) {
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
        return countResult[0].total;
    }

   
    async getProductsByLeadIds(leadIds) {
        const [allProducts] = await pool.query(
            `SELECT lp.*, p.name as product_name_from_db, p.category, p.price as original_price
             FROM lead_products lp
             LEFT JOIN products p ON lp.product_id = p.id
             WHERE lp.lead_id IN (?)`,
            [leadIds]
        );
        return allProducts;
    }

    // Get lead by ID
    async getLeadById(id) {
        const [leads] = await pool.query(
            `SELECT l.*, u.name as assigned_to_name
             FROM leads l
             LEFT JOIN users u ON l.assigned_to = u.id
             WHERE l.id = ?`,
            [id]
        );
        return leads[0];
    }


    async getProductsByLeadId(leadId) {
        const [products] = await pool.query(
            "SELECT * FROM lead_products WHERE lead_id = ?",
            [leadId]
        );
        return products;
    }

  
    async checkLeadExists(id) {
        const [existingLead] = await pool.query(
            "SELECT id FROM leads WHERE id = ?",
            [id]
        );
        return existingLead.length > 0;
    }

   
    async updateLeadWithTransaction(id, leadData, products, userId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            
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
                    leadData.company_name,
                    leadData.contact_person,
                    leadData.phone,
                    leadData.email,
                    leadData.address,
                    leadData.city,
                    leadData.state,
                    leadData.gst_number,
                    leadData.lead_source,
                    leadData.priority,
                    leadData.status || 'New',
                    leadData.expected_close_date,
                    leadData.followup_date,
                    leadData.notes,
                    leadData.assigned_to || userId,
                    id,
                ]
            );

            
            await connection.query("DELETE FROM lead_products WHERE lead_id = ?", [id]);

           
            if (products && products.length > 0) {
                for (const product of products) {
                    let productId = product.product_id || null;
                    let variantId = product.variant_id || null;
                    let productName = product.product_name;
                    let variantName = product.variant;
                    let unitPrice = product.unit_price;
                    let quantity = product.quantity;

                    
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
                            throw new Error(`Product with ID ${productId} not found or inactive`);
                        }
                    }

                   
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
                            throw new Error(`Variant with ID ${variantId} not found`);
                        }
                    }

                    if (!productName) {
                        throw new Error("Product name is required for each product");
                    }

                    if (!quantity || quantity <= 0) {
                        throw new Error("Valid quantity is required for each product");
                    }

                    if (!unitPrice || unitPrice <= 0) {
                        throw new Error("Valid unit price is required for each product");
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
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    
    async deleteLead(id) {
        await pool.query("DELETE FROM leads WHERE id = ?", [id]);
    }

   
    async getAllProducts(search) {
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

        if (search) {
            productQuery += ` AND (p.name LIKE ? OR p.category LIKE ?)`;
            productParams.push(`%${search}%`, `%${search}%`);
        }

        const [products] = await pool.query(productQuery, productParams);
        return products;
    }

    
    async getProductsCount(search) {
        let countQuery = "SELECT COUNT(*) as total FROM products WHERE is_active = 1";
        const countParams = [];

        if (search) {
            countQuery += ` AND (name LIKE ? OR category LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`);
        }

        const [countResult] = await pool.query(countQuery, countParams);
        return countResult[0].total;
    }

   
    async getVariantsByProductIds(productIds) {
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
            [productIds]
        );
        return variants;
    }
}

module.exports = LeadModel;