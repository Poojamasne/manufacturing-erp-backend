const pool = require('../../config/database');

class QuotationController {
    async createQuotation(req, res) {
        try {
            const { 
                opportunity_id, lead_id, company_name, contact_person, email, phone,
                billing_address, shipping_address, gst_number,
                quotation_date, valid_until,
                payment_terms, delivery_terms, currency,
                items, discount = 0, tax = 0, notes, terms_conditions
            } = req.body;
            
            if (!company_name || !items || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Company name and at least one item are required'
                });
            }
            
            // Calculate totals
            const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
            const total = subtotal - discount + tax;
            
            // Generate quote ID
            const [lastQuote] = await pool.query('SELECT quote_id FROM quotations ORDER BY id DESC LIMIT 1');
            let quoteId = 'QT-001';
            if (lastQuote.length > 0) {
                const num = parseInt(lastQuote[0].quote_id.substring(3)) + 1;
                quoteId = 'QT-' + num.toString().padStart(3, '0');
            }
            
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                
                const [result] = await connection.query(
                    `INSERT INTO quotations (
                        quote_id, opportunity_id, lead_id, company_name, 
                        contact_person, email, phone, 
                        billing_address, shipping_address, gst_number,
                        quotation_date, valid_until,
                        payment_terms, delivery_terms, currency,
                        subtotal, discount, tax, total, 
                        notes, terms_conditions, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        quoteId, opportunity_id || null, lead_id || null, company_name,
                        contact_person || null, email || null, phone || null,
                        billing_address || null, shipping_address || null, gst_number || null,
                        quotation_date || null, valid_until || null,
                        payment_terms || 'Net 30', delivery_terms || 'FOB', currency || 'INR',
                        subtotal, discount, tax, total,
                        notes || null, terms_conditions || null, req.user.id
                    ]
                );
                
                // Insert items
                for (const item of items) {
                    await connection.query(
                        `INSERT INTO quotation_items (
                            quotation_id, product_name, description, 
                            quantity, unit_price, discount, tax, total_price
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            result.insertId, 
                            item.product_name, 
                            item.description || null,
                            item.quantity, 
                            item.unit_price,
                            item.discount || 0,
                            item.tax || 18,
                            item.quantity * item.unit_price
                        ]
                    );
                }
                
                await connection.commit();
                
                // Fetch the created quotation with items
                const [newQuotation] = await connection.query(
                    `SELECT q.*, u.name as created_by_name
                     FROM quotations q
                     LEFT JOIN users u ON q.created_by = u.id
                     WHERE q.id = ?`,
                    [result.insertId]
                );
                
                const [newItems] = await connection.query(
                    'SELECT * FROM quotation_items WHERE quotation_id = ?',
                    [result.insertId]
                );
                
                res.status(201).json({
                    success: true,
                    message: 'Quotation created successfully',
                    data: { ...newQuotation[0], products: newItems }
                });
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error creating quotation:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating quotation',
                error: error.message
            });
        }
    }
    
    async getAllQuotations(req, res) {
        try {
            const { status, search, page = 1, limit = 10 } = req.query;
            
            let query = `
                SELECT 
                    q.*, 
                    u.name as created_by_name,
                    COUNT(DISTINCT qi.id) as item_count
                FROM quotations q
                LEFT JOIN users u ON q.created_by = u.id
                LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
                WHERE 1=1
            `;
            const params = [];
            
            if (status && status !== 'All') {
                query += ` AND q.status = ?`;
                params.push(status);
            }
            if (search) {
                query += ` AND (q.company_name LIKE ? OR q.quote_id LIKE ?)`;
                const searchTerm = `%${search}%`;
                params.push(searchTerm, searchTerm);
            }
            
            query += ` GROUP BY q.id ORDER BY q.created_at DESC LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
            
            const [quotations] = await pool.query(query, params);
            
            // Get total count for pagination
            let countQuery = 'SELECT COUNT(*) as total FROM quotations WHERE 1=1';
            const countParams = [];
            
            if (status && status !== 'All') {
                countQuery += ` AND status = ?`;
                countParams.push(status);
            }
            if (search) {
                countQuery += ` AND (company_name LIKE ? OR quote_id LIKE ?)`;
                countParams.push(`%${search}%`, `%${search}%`);
            }
            
            const [countResult] = await pool.query(countQuery, countParams);
            
            // Fetch items for all quotations (optional - for better performance)
            if (quotations.length > 0) {
                const quoteIds = quotations.map(q => q.id);
                const [allItems] = await pool.query(
                    `SELECT * FROM quotation_items WHERE quotation_id IN (?)`,
                    [quoteIds]
                );
                
                // Group items by quotation_id
                const itemsByQuote = {};
                allItems.forEach(item => {
                    if (!itemsByQuote[item.quotation_id]) {
                        itemsByQuote[item.quotation_id] = [];
                    }
                    itemsByQuote[item.quotation_id].push(item);
                });
                
                // Attach items to each quotation
                quotations.forEach(quote => {
                    quote.products = itemsByQuote[quote.id] || [];
                });
            }
            
            res.status(200).json({
                success: true,
                data: quotations,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countResult[0].total,
                    pages: Math.ceil(countResult[0].total / limit)
                }
            });
        } catch (error) {
            console.error('Error fetching quotations:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching quotations',
                error: error.message
            });
        }
    }
    
    async getQuotationById(req, res) {
        try {
            const { id } = req.params;
            
            const [quotations] = await pool.query(
                `SELECT q.*, u.name as created_by_name
                 FROM quotations q
                 LEFT JOIN users u ON q.created_by = u.id
                 WHERE q.id = ?`,
                [id]
            );
            
            if (quotations.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Quotation not found'
                });
            }
            
            const [items] = await pool.query(
                `SELECT 
                    id, product_name, description, quantity, 
                    unit_price, discount, tax, total_price
                 FROM quotation_items 
                 WHERE quotation_id = ?`,
                [id]
            );
            
            // Format dates for frontend
            const quotation = quotations[0];
            if (quotation.quotation_date) {
                quotation.quotation_date = quotation.quotation_date.toISOString().split('T')[0];
            }
            if (quotation.valid_until) {
                quotation.valid_until = quotation.valid_until.toISOString().split('T')[0];
            }
            if (quotation.created_at) {
                quotation.created_at = quotation.created_at.toISOString().split('T')[0];
            }
            
            res.status(200).json({
                success: true,
                data: { ...quotation, products: items }
            });
        } catch (error) {
            console.error('Error fetching quotation:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching quotation',
                error: error.message
            });
        }
    }
    
    async updateQuotation(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            
            const allowedFields = [
                'valid_until', 'discount', 'tax', 'notes', 'status',
                'billing_address', 'shipping_address', 'gst_number',
                'payment_terms', 'delivery_terms', 'currency',
                'contact_person', 'email', 'phone', 'company_name',
                'quotation_date', 'terms_conditions'
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
                    message: 'No fields to update'
                });
            }
            
            params.push(id);
            await pool.query(
                `UPDATE quotations SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
                params
            );
            
            // Fetch updated quotation with items
            const [updatedQuotation] = await pool.query(
                `SELECT q.*, u.name as created_by_name
                 FROM quotations q
                 LEFT JOIN users u ON q.created_by = u.id
                 WHERE q.id = ?`,
                [id]
            );
            
            const [updatedItems] = await pool.query(
                'SELECT * FROM quotation_items WHERE quotation_id = ?',
                [id]
            );
            
            res.status(200).json({
                success: true,
                message: 'Quotation updated successfully',
                data: { ...updatedQuotation[0], products: updatedItems }
            });
        } catch (error) {
            console.error('Error updating quotation:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating quotation',
                error: error.message
            });
        }
    }
    
    async deleteQuotation(req, res) {
        try {
            const { id } = req.params;
            
            // Check if quotation exists
            const [existing] = await pool.query('SELECT id FROM quotations WHERE id = ?', [id]);
            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Quotation not found'
                });
            }
            
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                
                // Delete quotation items first (foreign key constraint)
                await connection.query('DELETE FROM quotation_items WHERE quotation_id = ?', [id]);
                
                // Delete quotation
                await connection.query('DELETE FROM quotations WHERE id = ?', [id]);
                
                await connection.commit();
                
                res.status(200).json({
                    success: true,
                    message: 'Quotation deleted successfully'
                });
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error deleting quotation:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting quotation',
                error: error.message
            });
        }
    }
    
    // Additional utility method to update quotation status
    async updateQuotationStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            
            const validStatuses = ['Draft', 'Sent', 'Accepted', 'Rejected'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status value'
                });
            }
            
            await pool.query(
                'UPDATE quotations SET status = ?, updated_at = NOW() WHERE id = ?',
                [status, id]
            );
            
            res.status(200).json({
                success: true,
                message: `Quotation status updated to ${status}`,
                data: { id: parseInt(id), status }
            });
        } catch (error) {
            console.error('Error updating quotation status:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating quotation status',
                error: error.message
            });
        }
    }
}

module.exports = new QuotationController();