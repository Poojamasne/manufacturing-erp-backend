const pool = require('../../config/database');

class OpportunityController {
    async createOpportunity(req, res) {
        try {
            const { lead_id, company_name, contact_person, phone, email, value, 
                    stage, priority, source, expected_close_date, assigned_to, notes } = req.body;
            
            if (!company_name) {
                return res.status(400).json({
                    success: false,
                    message: 'Company name is required'
                });
            }
            
            // Generate opportunity ID
            const [lastOpp] = await pool.query('SELECT opp_id FROM opportunities ORDER BY id DESC LIMIT 1');
            let oppId = 'OP001';
            if (lastOpp.length > 0) {
                const num = parseInt(lastOpp[0].opp_id.substring(2)) + 1;
                oppId = 'OP' + num.toString().padStart(3, '0');
            }
            
            const [result] = await pool.query(
                `INSERT INTO opportunities (opp_id, lead_id, company_name, contact_person, phone, email,
                    value, stage, priority, source, expected_close_date, assigned_to, created_by, notes, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
                [oppId, lead_id || null, company_name, contact_person || null, phone || null,
                 email || null, value || 0, stage || 'Discovery', priority || 'Medium',
                 source || null, expected_close_date || null, assigned_to || null,
                 req.user.id, notes || null]
            );
            
            res.status(201).json({
                success: true,
                message: 'Opportunity created successfully',
                data: { opp_id: oppId, id: result.insertId }
            });
        } catch (error) {
            console.error('Error creating opportunity:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating opportunity',
                error: error.message
            });
        }
    }
    
    async getAllOpportunities(req, res) {
    try {
        const { stage, status, search } = req.query;
        
        // Build the base query to get opportunities from leads
        let query = `
            SELECT 
                l.id as lead_id,
                l.lead_id as opportunity_id,
                l.company_name,
                l.contact_person,
                l.phone,
                l.email,
                l.address,
                l.city,
                l.state,
                l.gst_number,
                l.lead_source as source,
                l.priority,
                l.expected_close_date,
                l.followup_date,
                l.notes,
                l.assigned_to,
                l.created_by,
                l.status,
                l.created_at,
                l.updated_at,
                u.name as assigned_to_name,
                u2.name as created_by_name,
                COALESCE(SUM(lp.total_price), 0) as value
            FROM leads l
            LEFT JOIN users u ON l.assigned_to = u.id
            LEFT JOIN users u2 ON l.created_by = u2.id
            LEFT JOIN lead_products lp ON l.id = lp.lead_id
            WHERE l.status NOT IN ('New', 'Contacted')
        `;
        
        const params = [];
        
        // Apply filters
        if (stage && stage !== 'All') {
            query += ` AND l.status = ?`;
            params.push(stage);
        }
        
        if (status && status !== 'All') {
            query += ` AND l.status = ?`;
            params.push(status);
        }
        
        if (search) {
            query += ` AND (l.company_name LIKE ? OR l.lead_id LIKE ? OR l.contact_person LIKE ? OR l.phone LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        
        // Group by lead to get sum of products
        query += ` GROUP BY l.id`;
        
        // Add ordering
        query += ` ORDER BY l.created_at DESC`;
        
        const [opportunities] = await pool.query(query, params);
        
        // Fetch products for all opportunities
        if (opportunities.length > 0) {
            const leadIds = opportunities.map((opp) => opp.lead_id);
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
            
            // Attach products to each opportunity
            opportunities.forEach((opportunity) => {
                opportunity.products = productsByLead[opportunity.lead_id] || [];
            });
        }
        
        // Format dates properly
        opportunities.forEach((opportunity) => {
            if (opportunity.expected_close_date) {
                opportunity.expected_close_date = opportunity.expected_close_date.toISOString().split('T')[0];
            }
            if (opportunity.created_at) {
                opportunity.created_at = opportunity.created_at.toISOString().split('T')[0];
            }
            if (opportunity.updated_at) {
                opportunity.updated_at = opportunity.updated_at.toISOString().split('T')[0];
            }
        });
        
        res.status(200).json({
            success: true,
            data: opportunities
        });
        
    } catch (error) {
        console.error('Error fetching opportunities:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching opportunities',
            error: error.message
        });
    }
}
    
    async getOpportunityById(req, res) {
        try {
            const { id } = req.params;
            
            const [opportunities] = await pool.query(
                `SELECT 
                    o.*,
                    u.name as assigned_to_name,
                    u2.name as created_by_name
                 FROM opportunities o
                 LEFT JOIN users u ON o.assigned_to = u.id
                 LEFT JOIN users u2 ON o.created_by = u2.id
                 WHERE o.id = ?`,
                [id]
            );
            
            if (opportunities.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Opportunity not found'
                });
            }
            
            // Format dates properly
            const opportunity = opportunities[0];
            if (opportunity.expected_close_date) {
                opportunity.expected_close_date = opportunity.expected_close_date.toISOString().split('T')[0];
            }
            if (opportunity.created_at) {
                opportunity.created_at = opportunity.created_at.toISOString().split('T')[0];
            }
            if (opportunity.updated_at) {
                opportunity.updated_at = opportunity.updated_at.toISOString().split('T')[0];
            }
            
            res.status(200).json({
                success: true,
                data: opportunity
            });
        } catch (error) {
            console.error('Error fetching opportunity:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching opportunity',
                error: error.message
            });
        }
    }
    
    async updateOpportunity(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            
            const allowedFields = ['company_name', 'contact_person', 'phone', 'email', 'value',
                                   'stage', 'priority', 'source', 'expected_close_date', 
                                   'assigned_to', 'notes', 'status'];
            
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
                `UPDATE opportunities SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
                params
            );
            
            // Get updated opportunity
            const [updated] = await pool.query(
                `SELECT o.*, u.name as assigned_to_name, u2.name as created_by_name
                 FROM opportunities o
                 LEFT JOIN users u ON o.assigned_to = u.id
                 LEFT JOIN users u2 ON o.created_by = u2.id
                 WHERE o.id = ?`,
                [id]
            );
            
            res.status(200).json({
                success: true,
                message: 'Opportunity updated successfully',
                data: updated[0]
            });
        } catch (error) {
            console.error('Error updating opportunity:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating opportunity',
                error: error.message
            });
        }
    }
    
    async deleteOpportunity(req, res) {
        try {
            const { id } = req.params;
            
            // Check if opportunity exists
            const [existing] = await pool.query('SELECT id FROM opportunities WHERE id = ?', [id]);
            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Opportunity not found'
                });
            }
            
            await pool.query('DELETE FROM opportunities WHERE id = ?', [id]);
            
            res.status(200).json({
                success: true,
                message: 'Opportunity deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting opportunity:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting opportunity',
                error: error.message
            });
        }
    }
}

module.exports = new OpportunityController();