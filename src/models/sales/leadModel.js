const pool = require('../../config/database');

class LeadModel {
    static async generateLeadId() {
        try {
            const [rows] = await pool.query('SELECT lead_id FROM leads ORDER BY id DESC LIMIT 1');
            if (rows.length === 0) return 'L001';
            const lastId = rows[0].lead_id;
            const num = parseInt(lastId.substring(1)) + 1;
            return 'L' + num.toString().padStart(3, '0');
        } catch (error) {
            console.error('Error generating lead ID:', error);
            return 'L001';
        }
    }

    static async createLead(leadData, products) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const leadId = await this.generateLeadId();
            
            const [result] = await connection.query(
                `INSERT INTO leads (
                    lead_id, company_name, contact_person, designation, owner_name, 
                    phone_number, email_id, gst_number, city, state, lead_source, 
                    priority, expected_decision_date, follow_up_date, initial_status, 
                    address, notes, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    leadId, 
                    leadData.company_name, 
                    leadData.contact_person, 
                    leadData.designation, 
                    leadData.owner_name, 
                    leadData.phone_number, 
                    leadData.email_id, 
                    leadData.gst_number, 
                    leadData.city, 
                    leadData.state, 
                    leadData.lead_source, 
                    leadData.priority, 
                    leadData.expected_decision_date, 
                    leadData.follow_up_date, 
                    leadData.initial_status || 'New Lead', 
                    leadData.address, 
                    leadData.notes, 
                    'New Lead'
                ]
            );
            
            const leadId_db = result.insertId;
            
            if (products && products.length > 0) {
                for (const product of products) {
                    await connection.query(
                        `INSERT INTO lead_products (
                            lead_id, product_name, variant_model, quantity, 
                            unit_approx, est_value
                        ) VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            leadId_db,
                            product.product_name,
                            product.variant_model || null,
                            product.quantity,
                            product.unit_approx || null,
                            product.est_value || (product.quantity * (product.unit_price || 0))
                        ]
                    );
                }
            }
            
            await connection.commit();
            
            const [createdLead] = await connection.query(
                `SELECT * FROM leads WHERE id = ?`,
                [leadId_db]
            );
            
            let leadProducts = [];
            if (products && products.length > 0) {
                [leadProducts] = await connection.query(
                    `SELECT * FROM lead_products WHERE lead_id = ?`,
                    [leadId_db]
                );
            }
            
            return { 
                ...createdLead[0], 
                lead_id: leadId,
                products: leadProducts 
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getAllLeads(filters) {
        try {
            let query = `
                SELECT l.*, 
                       COUNT(lp.id) as product_count,
                       COALESCE(SUM(lp.est_value), 0) as total_value
                FROM leads l
                LEFT JOIN lead_products lp ON l.id = lp.lead_id
                WHERE 1=1
            `;
            const params = [];
            
            if (filters.status) {
                query += ` AND l.status = ?`;
                params.push(filters.status);
            }
            
            if (filters.priority) {
                query += ` AND l.priority = ?`;
                params.push(filters.priority);
            }
            
            if (filters.search) {
                query += ` AND (l.company_name LIKE ? OR l.contact_person LIKE ? OR l.email_id LIKE ? OR l.phone_number LIKE ?)`;
                const searchTerm = `%${filters.search}%`;
                params.push(searchTerm, searchTerm, searchTerm, searchTerm);
            }
            
            query += ` GROUP BY l.id ORDER BY l.created_at DESC LIMIT ? OFFSET ?`;
            params.push(filters.limit, filters.offset);
            
            const [leads] = await pool.query(query, params);
            return leads;
        } catch (error) {
            console.error('Error getting all leads:', error);
            throw error;
        }
    }

    static async getLeadById(id) {
        try {
            const [leads] = await pool.query(
                `SELECT l.*, 
                        COUNT(lp.id) as product_count,
                        COALESCE(SUM(lp.est_value), 0) as total_value
                 FROM leads l
                 LEFT JOIN lead_products lp ON l.id = lp.lead_id
                 WHERE l.id = ?
                 GROUP BY l.id`,
                [id]
            );
            
            if (leads.length === 0) return null;
            
            const [products] = await pool.query(
                `SELECT * FROM lead_products WHERE lead_id = ?`,
                [id]
            );
            
            return {
                ...leads[0],
                products
            };
        } catch (error) {
            console.error('Error getting lead by ID:', error);
            throw error;
        }
    }

    static async updateLead(id, leadData) {
        try {
            const updateFields = [];
            const params = [];
            
            const allowedFields = [
                'company_name', 'contact_person', 'designation', 'owner_name',
                'phone_number', 'email_id', 'gst_number', 'city', 'state',
                'lead_source', 'priority', 'status', 'notes', 'address',
                'expected_decision_date', 'follow_up_date', 'initial_status'
            ];
            
            for (const field of allowedFields) {
                if (leadData[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    params.push(leadData[field]);
                }
            }
            
            if (updateFields.length === 0) return false;
            
            params.push(id);
            const query = `UPDATE leads SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`;
            
            const [result] = await pool.query(query, params);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating lead:', error);
            throw error;
        }
    }

    static async deleteLead(id) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            await connection.query('DELETE FROM lead_products WHERE lead_id = ?', [id]);
            const [result] = await connection.query('DELETE FROM leads WHERE id = ?', [id]);
            
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('Error deleting lead:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getLeadStatistics(filters) {
        try {
            let query = `
                SELECT 
                    COUNT(DISTINCT l.id) as total_leads,
                    SUM(CASE WHEN l.status = 'New Lead' THEN 1 ELSE 0 END) as new_leads,
                    SUM(CASE WHEN l.status = 'Contacted' THEN 1 ELSE 0 END) as contacted_leads,
                    SUM(CASE WHEN l.status = 'Quotation' THEN 1 ELSE 0 END) as quotation,
                    SUM(CASE WHEN l.status = 'Won' THEN 1 ELSE 0 END) as won_leads,
                    SUM(CASE WHEN l.status = 'Lost' THEN 1 ELSE 0 END) as lost_leads,
                    SUM(CASE WHEN l.status = 'Converted' THEN 1 ELSE 0 END) as converted_leads,
                    AVG(CASE WHEN l.status IN ('Won', 'Converted') THEN DATEDIFF(l.updated_at, l.created_at) END) as avg_conversion_days,
                    COALESCE(SUM(CASE WHEN l.status = 'Won' THEN lp.est_value ELSE 0 END), 0) as total_revenue
                FROM leads l
                LEFT JOIN lead_products lp ON l.id = lp.lead_id
                WHERE 1=1
            `;
            const params = [];
            
            if (filters.date_range) {
                query += ` AND DATE(l.created_at) BETWEEN ? AND ?`;
                params.push(filters.date_range.start, filters.date_range.end);
            }
            
            const [stats] = await pool.query(query, params);
            return stats[0] || {
                total_leads: 0,
                new_leads: 0,
                contacted_leads: 0,
                quotation: 0,
                won_leads: 0,
                lost_leads: 0,
                converted_leads: 0,
                avg_conversion_days: null,
                total_revenue: 0
            };
        } catch (error) {
            console.error('Error getting lead statistics:', error);
            throw error;
        }
    }

    static async getPipelinePerformance(filters) {
        try {
            let query = `
                SELECT 
                    l.status,
                    COUNT(DISTINCT l.id) as \`count\`,
                    SUM(CASE WHEN l.priority = 'High' THEN 1 ELSE 0 END) as high_priority,
                    SUM(CASE WHEN l.priority = 'Medium' THEN 1 ELSE 0 END) as medium_priority,
                    SUM(CASE WHEN l.priority = 'Low' THEN 1 ELSE 0 END) as low_priority,
                    SUM(CASE WHEN l.priority = 'Critical' THEN 1 ELSE 0 END) as critical_priority,
                    AVG(DATEDIFF(NOW(), l.created_at)) as avg_age_days,
                    COALESCE(SUM(lp.est_value), 0) as total_value
                FROM leads l
                LEFT JOIN lead_products lp ON l.id = lp.lead_id
                WHERE 1=1
            `;
            const params = [];
            
            if (filters.date_range) {
                query += ` AND DATE(l.created_at) BETWEEN ? AND ?`;
                params.push(filters.date_range.start, filters.date_range.end);
            }
            
            query += ` GROUP BY l.status ORDER BY 
                         CASE l.status 
                            WHEN 'New Lead' THEN 1
                            WHEN 'Contacted' THEN 2
                            WHEN 'Quotation' THEN 3
                            WHEN 'Won' THEN 4
                            WHEN 'Converted' THEN 5
                            WHEN 'Lost' THEN 6
                            ELSE 7
                         END`;
            
            const [pipeline] = await pool.query(query, params);
            return pipeline;
        } catch (error) {
            console.error('Error getting pipeline performance:', error);
            throw error;
        }
    }

    static async getSalesByCategory(filters) {
        try {
            let query = `
                SELECT 
                    l.lead_source as category,
                    COUNT(DISTINCT l.id) as lead_count,
                    SUM(CASE WHEN l.status = 'Won' THEN 1 ELSE 0 END) as won_count,
                    SUM(CASE WHEN l.status = 'Lost' THEN 1 ELSE 0 END) as lost_count,
                    COALESCE(SUM(CASE WHEN l.status = 'Won' THEN lp.est_value ELSE 0 END), 0) as total_revenue
                FROM leads l
                LEFT JOIN lead_products lp ON l.id = lp.lead_id
                WHERE 1=1
            `;
            const params = [];
            
            if (filters.date_range) {
                query += ` AND DATE(l.created_at) BETWEEN ? AND ?`;
                params.push(filters.date_range.start, filters.date_range.end);
            }
            
            query += ` GROUP BY l.lead_source ORDER BY total_revenue DESC`;
            
            const [sales] = await pool.query(query, params);
            return sales;
        } catch (error) {
            console.error('Error getting sales by category:', error);
            throw error;
        }
    }

    static async getRecentLeads(limit = 5) {
        try {
            const [leads] = await pool.query(
                `SELECT l.id, l.lead_id, l.company_name, l.contact_person, 
                        l.phone_number, l.email_id, l.status, l.created_at
                 FROM leads l
                 ORDER BY l.created_at DESC
                 LIMIT ?`,
                [limit]
            );
            return leads;
        } catch (error) {
            console.error('Error getting recent leads:', error);
            return [];
        }
    }
}

module.exports = LeadModel;