const pool = require('../../config/database');

class ProductionController {
    async getAllJobs(req, res) {
        try {
            const { status, stage, search, page = 1, limit = 10, dateRange, startDate, endDate } = req.query;
            
            console.log('Query params:', { status, stage, search, page, limit, dateRange, startDate, endDate });
            
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
                console.log('Applying status filter:', status);
            }
            
            // Stage filter - ADDED
            if (stage && stage !== 'All') {
                query += ` AND p.stage = ?`;
                params.push(stage);
                console.log('Applying stage filter:', stage);
            }
            
            // Search filter
            if (search) {
                query += ` AND (p.product_name LIKE ? OR p.job_id LIKE ? OR o.customer_name LIKE ?)`;
                const searchTerm = `%${search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
                console.log('Applying search filter:', search);
            }
            
            // Date range filters - APPLY TO MAIN QUERY
            if (dateRange === 'Weekly') {
                query += ` AND p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
                console.log('Applying Weekly filter');
            } else if (dateRange === 'Monthly') {
                query += ` AND p.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
                console.log('Applying Monthly filter');
            } else if (dateRange === 'Quarterly') {
                query += ` AND p.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
                console.log('Applying Quarterly filter');
            } else if (dateRange === 'Yearly') {
                query += ` AND p.created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
                console.log('Applying Yearly filter');
            } else if (dateRange === 'Custom' && startDate && endDate) {
                query += ` AND DATE(p.created_at) BETWEEN ? AND ?`;
                params.push(startDate, endDate);
                console.log('Applying Custom filter:', startDate, endDate);
            }
            
            // Build count query with SAME filters
            let countQuery = `SELECT COUNT(*) as total FROM production_jobs p WHERE 1=1`;
            const countParams = [];
            
            if (status && status !== 'All') {
                countQuery += ` AND p.status = ?`;
                countParams.push(status);
            }
            
            // Stage filter for count query - ADDED
            if (stage && stage !== 'All') {
                countQuery += ` AND p.stage = ?`;
                countParams.push(stage);
            }
            
            if (search) {
                countQuery += ` AND (p.product_name LIKE ? OR p.job_id LIKE ?)`;
                const searchTerm = `%${search}%`;
                countParams.push(searchTerm, searchTerm);
            }
            
            // CRITICAL FIX: Add date filters to COUNT query
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
            
            console.log('Main Query:', query);
            console.log('Count Query:', countQuery);
            console.log('Params:', params);
            
            // Execute queries
            const [jobs] = await pool.query(query, params);
            const [countResult] = await pool.query(countQuery, countParams);
            const total = countResult[0]?.total || 0;
            
            console.log(`Found ${jobs.length} jobs, Total: ${total}`);
            
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
            
            console.log('Fetching job ID:', id);
            
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
            
            console.log('=========================================');
            console.log('UPDATE PRODUCTION JOB');
            console.log('Job ID:', id);
            console.log('Update Data:', JSON.stringify(updates, null, 2));
            console.log('=========================================');
            
            const allowedFields = ['stage', 'status', 'started_at', 'completed_at', 'assigned_to', 'notes'];
            
            const updateFields = [];
            const params = [];
            
            for (const field of allowedFields) {
                if (updates[field] !== undefined && updates[field] !== null && updates[field] !== '') {
                    updateFields.push(`${field} = ?`);
                    params.push(updates[field]);
                    console.log(`Updating ${field} = ${updates[field]}`);
                }
            }
            
            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No fields to update'
                });
            }
            
            params.push(id);
            
            const updateQuery = `UPDATE production_jobs SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`;
            console.log('Update Query:', updateQuery);
            console.log('Params:', params);
            
            const [result] = await pool.query(updateQuery, params);
            console.log('Update result:', result);
            
            // Fetch updated job
            const [updatedJob] = await pool.query(
                `SELECT p.*, o.customer_name, u.name as assigned_to_name
                 FROM production_jobs p
                 LEFT JOIN orders o ON p.order_id = o.id
                 LEFT JOIN users u ON p.assigned_to = u.id
                 WHERE p.id = ?`,
                [id]
            );
            
            console.log('Updated job data:', updatedJob[0]);
            
            res.status(200).json({
                success: true,
                message: 'Production job updated successfully',
                data: updatedJob[0] || null
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
            
            console.log('Deleting job ID:', id);
            
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