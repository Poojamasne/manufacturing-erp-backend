const pool = require('../../config/database');

class ProductionController {
    async getAllJobs(req, res) {
        try {
            const { status, search, page = 1, limit = 10, dateRange, startDate, endDate } = req.query;
            
            let query = `
                SELECT p.*, o.customer_name, u.name as assigned_to_name
                FROM production_jobs p
                LEFT JOIN orders o ON p.order_id = o.id
                LEFT JOIN users u ON p.assigned_to = u.id
                WHERE 1=1
            `;
            const params = [];
            
            // Status filter
            if (status && status !== 'All') {
                query += ` AND p.status = ?`;
                params.push(status);
            }
            
            // Search filter
            if (search) {
                query += ` AND (p.product_name LIKE ? OR p.job_id LIKE ? OR o.customer_name LIKE ?)`;
                const searchTerm = `%${search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }
            
            // Date range filters
            if (dateRange === 'Weekly') {
                query += ` AND p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
            } else if (dateRange === 'Monthly') {
                query += ` AND p.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
            } else if (dateRange === 'Quarterly') {
                query += ` AND p.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
            } else if (dateRange === 'Yearly') {
                query += ` AND p.created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
            } else if (dateRange === 'Custom' && startDate && endDate) {
                query += ` AND DATE(p.created_at) BETWEEN ? AND ?`;
                params.push(startDate, endDate);
            }
            
            // Build count query with same filters
            let countQuery = `SELECT COUNT(*) as total FROM production_jobs p WHERE 1=1`;
            const countParams = [];
            
            if (status && status !== 'All') {
                countQuery += ` AND p.status = ?`;
                countParams.push(status);
            }
            if (search) {
                countQuery += ` AND (p.product_name LIKE ? OR p.job_id LIKE ?)`;
                const searchTerm = `%${search}%`;
                countParams.push(searchTerm, searchTerm);
            }
            if (dateRange === 'Weekly') {
                countQuery += ` AND p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
            } else if (dateRange === 'Monthly') {
                countQuery += ` AND p.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
            } else if (dateRange === 'Quarterly') {
                countQuery += ` AND p.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
            } else if (dateRange === 'Yearly') {
                countQuery += ` AND p.created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
            } else if (dateRange === 'Custom' && startDate && endDate) {
                countQuery += ` AND DATE(p.created_at) BETWEEN ? AND ?`;
                countParams.push(startDate, endDate);
            }
            
            // Add pagination
            const parsedPage = parseInt(page) || 1;
            const parsedLimit = parseInt(limit) || 10;
            const offset = (parsedPage - 1) * parsedLimit;
            
            query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
            params.push(parsedLimit, offset);
            
            // Execute queries
            const [jobs] = await pool.query(query, params);
            const [countResult] = await pool.query(countQuery, countParams);
            const total = countResult[0]?.total || 0;
            
            res.status(200).json({
                success: true,
                data: jobs,
                pagination: {
                    page: parsedPage,
                    limit: parsedLimit,
                    total: total,
                    pages: Math.ceil(total / parsedLimit)
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
            
            const allowedFields = ['stage', 'status', 'started_at', 'completed_at', 'assigned_to', 'notes'];
            
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
            
            // Fetch updated job
            const [updatedJob] = await pool.query(
                `SELECT p.*, o.customer_name, u.name as assigned_to_name
                 FROM production_jobs p
                 LEFT JOIN orders o ON p.order_id = o.id
                 LEFT JOIN users u ON p.assigned_to = u.id
                 WHERE p.id = ?`,
                [id]
            );
            
            res.status(200).json({
                success: true,
                message: 'Production job updated successfully',
                data: updatedJob[0]
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