const pool = require('../../config/database');

class ProductionController {
    async getAllJobs(req, res) {
        try {
            const { status, search, page = 1, limit = 10 } = req.query;
            
            let query = `
                SELECT p.*, o.customer_name, u.name as assigned_to_name
                FROM production_jobs p
                LEFT JOIN orders o ON p.order_id = o.id
                LEFT JOIN users u ON p.assigned_to = u.id
                WHERE 1=1
            `;
            const params = [];
            
            if (status && status !== 'All') {
                query += ` AND p.status = ?`;
                params.push(status);
            }
            if (search) {
                query += ` AND (p.product_name LIKE ? OR p.job_id LIKE ? OR o.customer_name LIKE ?)`;
                const searchTerm = `%${search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }
            
            query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
            
            const [jobs] = await pool.query(query, params);
            
            const [countResult] = await pool.query('SELECT COUNT(*) as total FROM production_jobs');
            
            res.status(200).json({
                success: true,
                data: jobs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countResult[0].total,
                    pages: Math.ceil(countResult[0].total / limit)
                }
            });
        } catch (error) {
            console.error('Error fetching production jobs:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching production jobs',
                error: error.message
            });
        }
    }
    
    async getJobById(req, res) {
        try {
            const { id } = req.params;
            
            const [jobs] = await pool.query(
                `SELECT p.*, o.customer_name, u.name as assigned_to_name
                 FROM production_jobs p
                 LEFT JOIN orders o ON p.order_id = o.id
                 LEFT JOIN users u ON p.assigned_to = u.id
                 WHERE p.id = ?`,
                [id]
            );
            
            if (jobs.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Production job not found'
                });
            }
            
            res.status(200).json({
                success: true,
                data: jobs[0]
            });
        } catch (error) {
            console.error('Error fetching production job:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching production job',
                error: error.message
            });
        }
    }
    
    async updateJob(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            
            const allowedFields = ['stage', 'status', 'started_at', 'completed_at', 'assigned_to'];
            
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
                `UPDATE production_jobs SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
                params
            );
            
            res.status(200).json({
                success: true,
                message: 'Production job updated successfully'
            });
        } catch (error) {
            console.error('Error updating production job:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating production job',
                error: error.message
            });
        }
    }
    
    async deleteJob(req, res) {
        try {
            const { id } = req.params;
            await pool.query('DELETE FROM production_jobs WHERE id = ?', [id]);
            
            res.status(200).json({
                success: true,
                message: 'Production job deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting production job:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting production job',
                error: error.message
            });
        }
    }
}

module.exports = new ProductionController();