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
            const { stage, status, search, page = 1, limit = 10 } = req.query;
            
            let query = `
                SELECT 
                    o.*,
                    u.name as assigned_to_name,
                    u2.name as created_by_name
                FROM opportunities o
                LEFT JOIN users u ON o.assigned_to = u.id
                LEFT JOIN users u2 ON o.created_by = u2.id
                WHERE 1=1
            `;
            const params = [];
            
            if (stage && stage !== 'All') {
                query += ` AND o.stage = ?`;
                params.push(stage);
            }
            if (status && status !== 'All') {
                query += ` AND o.status = ?`;
                params.push(status);
            }
            if (search) {
                query += ` AND (o.company_name LIKE ? OR o.opp_id LIKE ?)`;
                const searchTerm = `%${search}%`;
                params.push(searchTerm, searchTerm);
            }
            
            query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
            
            const [opportunities] = await pool.query(query, params);
            
            // Get total count without pagination
            let countQuery = 'SELECT COUNT(*) as total FROM opportunities WHERE 1=1';
            const countParams = [];
            
            if (stage && stage !== 'All') {
                countQuery += ` AND stage = ?`;
                countParams.push(stage);
            }
            if (status && status !== 'All') {
                countQuery += ` AND status = ?`;
                countParams.push(status);
            }
            
            const [countResult] = await pool.query(countQuery, countParams);
            
            res.status(200).json({
                success: true,
                data: opportunities,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countResult[0].total,
                    pages: Math.ceil(countResult[0].total / limit)
                }
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