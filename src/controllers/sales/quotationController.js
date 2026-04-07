const pool = require('../../config/database');

class QuotationController {
    async createQuotation(req, res) {
        try {
            const { opportunity_id, lead_id, company_name, contact_person, email, phone,
                    valid_until, items, discount = 0, tax = 0, notes } = req.body;
            
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
                    `INSERT INTO quotations (quote_id, opportunity_id, lead_id, company_name, 
                        contact_person, email, phone, valid_until, subtotal, discount, tax, total, notes, created_by)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [quoteId, opportunity_id || null, lead_id || null, company_name,
                     contact_person || null, email || null, phone || null, valid_until || null,
                     subtotal, discount, tax, total, notes || null, req.user.id]
                );
                
                // Insert items
                for (const item of items) {
                    await connection.query(
                        `INSERT INTO quotation_items (quotation_id, product_name, quantity, unit_price, total_price)
                         VALUES (?, ?, ?, ?, ?)`,
                        [result.insertId, item.product_name, item.quantity, 
                         item.unit_price, item.quantity * item.unit_price]
                    );
                }
                
                await connection.commit();
                
                res.status(201).json({
                    success: true,
                    message: 'Quotation created successfully',
                    data: { quote_id: quoteId, id: result.insertId }
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
                SELECT q.*, u.name as created_by_name,
                       (SELECT COUNT(*) FROM quotation_items WHERE quotation_id = q.id) as item_count
                FROM quotations q
                LEFT JOIN users u ON q.created_by = u.id
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
            
            query += ` ORDER BY q.created_at DESC LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
            
            const [quotations] = await pool.query(query, params);
            
            const [countResult] = await pool.query('SELECT COUNT(*) as total FROM quotations');
            
            res.status(200).json({
                success: true,
                data: quotations,
                
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
                'SELECT * FROM quotation_items WHERE quotation_id = ?',
                [id]
            );
            
            res.status(200).json({
                success: true,
                data: { ...quotations[0], items }
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
            
            const allowedFields = ['valid_until', 'discount', 'tax', 'notes', 'status'];
            
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
            
            res.status(200).json({
                success: true,
                message: 'Quotation updated successfully'
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
            await pool.query('DELETE FROM quotations WHERE id = ?', [id]);
            
            res.status(200).json({
                success: true,
                message: 'Quotation deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting quotation:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting quotation',
                error: error.message
            });
        }
    }
}

module.exports = new QuotationController();