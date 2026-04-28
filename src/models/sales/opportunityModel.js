const pool = require('../../config/database');

class OpportunityModel {
    
    async generateOpportunityId() {
        const [lastOpp] = await pool.query('SELECT opp_id FROM opportunities ORDER BY id DESC LIMIT 1');
        let oppId = 'OP001';
        if (lastOpp.length > 0) {
            const num = parseInt(lastOpp[0].opp_id.substring(2)) + 1;
            oppId = 'OP' + num.toString().padStart(3, '0');
        }
        return oppId;
    }

    
    async createOpportunity(opportunityData, userId) {
        const { oppId, lead_id, company_name, contact_person, phone, email, value, 
                stage, priority, source, expected_close_date, assigned_to, notes } = opportunityData;
        
        const [result] = await pool.query(
            `INSERT INTO opportunities (opp_id, lead_id, company_name, contact_person, phone, email,
                value, stage, priority, source, expected_close_date, assigned_to, created_by, notes, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
            [oppId, lead_id || null, company_name, contact_person || null, phone || null,
             email || null, value || 0, stage || 'Discovery', priority || 'Medium',
             source || null, expected_close_date || null, assigned_to || null,
             userId, notes || null]
        );
        
        return { oppId, insertId: result.insertId };
    }

   
    async getAllOpportunities(stage, status, search, page, limit) {
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
        return opportunities;
    }

    
    async getOpportunitiesCount(stage, status) {
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
        return countResult[0].total;
    }

    
    async getOpportunityById(id) {
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
        return opportunities[0];
    }

    
    async checkOpportunityExists(id) {
        const [existing] = await pool.query('SELECT id FROM opportunities WHERE id = ?', [id]);
        return existing.length > 0;
    }

    
    async updateOpportunity(id, updateFields, params) {
        params.push(id);
        await pool.query(
            `UPDATE opportunities SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
            params
        );
    }

    async getUpdatedOpportunity(id) {
        const [updated] = await pool.query(
            `SELECT o.*, u.name as assigned_to_name, u2.name as created_by_name
             FROM opportunities o
             LEFT JOIN users u ON o.assigned_to = u.id
             LEFT JOIN users u2 ON o.created_by = u2.id
             WHERE o.id = ?`,
            [id]
        );
        return updated[0];
    }

    async deleteOpportunity(id) {
        await pool.query('DELETE FROM opportunities WHERE id = ?', [id]);
    }
}

module.exports = OpportunityModel;