const pool = require('../../config/database');

class QuotationModel {
    
    async generateQuoteId() {
        const [lastQuote] = await pool.query('SELECT quote_id FROM quotations ORDER BY id DESC LIMIT 1');
        let quoteId = 'QT-001';
        if (lastQuote.length > 0) {
            const num = parseInt(lastQuote[0].quote_id.substring(3)) + 1;
            quoteId = 'QT-' + num.toString().padStart(3, '0');
        }
        return quoteId;
    }

   
    async createQuotationWithTransaction(quotationData, items, userId) {
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
                    quotationData.quoteId, 
                    quotationData.opportunity_id || null, 
                    quotationData.lead_id || null, 
                    quotationData.company_name,
                    quotationData.contact_person || null, 
                    quotationData.email || null, 
                    quotationData.phone || null,
                    quotationData.billing_address || null, 
                    quotationData.shipping_address || null, 
                    quotationData.gst_number || null,
                    quotationData.quotation_date || null, 
                    quotationData.valid_until || null,
                    quotationData.payment_terms || 'Net 30', 
                    quotationData.delivery_terms || 'FOB', 
                    quotationData.currency || 'INR',
                    quotationData.subtotal, 
                    quotationData.discount, 
                    quotationData.tax, 
                    quotationData.total,
                    quotationData.notes || null, 
                    quotationData.terms_conditions || null, 
                    userId
                ]
            );
            
           
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
            
            return { quotation: newQuotation[0], items: newItems };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async getAllQuotations(status, search, page, limit) {
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
        return quotations;
    }

    
    async getQuotationsCount(status, search) {
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
        return countResult[0].total;
    }

   
    async getItemsByQuoteIds(quoteIds) {
        const [allItems] = await pool.query(
            `SELECT * FROM quotation_items WHERE quotation_id IN (?)`,
            [quoteIds]
        );
        return allItems;
    }

    
    async getQuotationById(id) {
        const [quotations] = await pool.query(
            `SELECT q.*, u.name as created_by_name
             FROM quotations q
             LEFT JOIN users u ON q.created_by = u.id
             WHERE q.id = ?`,
            [id]
        );
        return quotations[0];
    }

    
    async getQuotationItems(quotationId) {
        const [items] = await pool.query(
            `SELECT 
                id, product_name, description, quantity, 
                unit_price, discount, tax, total_price
             FROM quotation_items 
             WHERE quotation_id = ?`,
            [quotationId]
        );
        return items;
    }

   
    async checkQuotationExists(id) {
        const [existing] = await pool.query('SELECT id FROM quotations WHERE id = ?', [id]);
        return existing.length > 0;
    }

    
    async updateQuotation(id, updateFields, params) {
        params.push(id);
        await pool.query(
            `UPDATE quotations SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
            params
        );
    }

    
    async getUpdatedQuotation(id) {
        const [updatedQuotation] = await pool.query(
            `SELECT q.*, u.name as created_by_name
             FROM quotations q
             LEFT JOIN users u ON q.created_by = u.id
             WHERE q.id = ?`,
            [id]
        );
        return updatedQuotation[0];
    }

    
    async deleteQuotationWithTransaction(id) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            await connection.query('DELETE FROM quotation_items WHERE quotation_id = ?', [id]);
            
            await connection.query('DELETE FROM quotations WHERE id = ?', [id]);
            
            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

   
    async updateQuotationStatus(id, status) {
        await pool.query(
            'UPDATE quotations SET status = ?, updated_at = NOW() WHERE id = ?',
            [status, id]
        );
    }
}

module.exports = QuotationModel;