const pool = require('../../config/database');

class ProductionModel {
    
    async getAllJobs(status, stage, search, page, limit, dateRange, startDate, endDate) {
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
        
        
        if (stage && stage !== 'All') {
            query += ` AND p.stage = ?`;
            params.push(stage);
        }
        
        
        if (search) {
            query += ` AND (p.product_name LIKE ? OR p.job_id LIKE ? OR o.customer_name LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
       
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
        
       
        const parsedPage = parseInt(page) || 1;
        const parsedLimit = parseInt(limit) || 10;
        const offset = (parsedPage - 1) * parsedLimit;
        
        query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parsedLimit, offset);
        
        const [jobs] = await pool.query(query, params);
        return { jobs, parsedPage, parsedLimit };
    }

    
    async getJobsCount(status, stage, search, dateRange, startDate, endDate) {
        let countQuery = `SELECT COUNT(*) as total FROM production_jobs p WHERE 1=1`;
        const countParams = [];
        
        if (status && status !== 'All') {
            countQuery += ` AND p.status = ?`;
            countParams.push(status);
        }
        
        if (stage && stage !== 'All') {
            countQuery += ` AND p.stage = ?`;
            countParams.push(stage);
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
        
        const [countResult] = await pool.query(countQuery, countParams);
        return countResult[0]?.total || 0;
    }

    
    async getJobById(id) {
        const [jobs] = await pool.query(
            `SELECT p.*, o.customer_name, u.name as assigned_to_name
             FROM production_jobs p
             LEFT JOIN orders o ON p.order_id = o.id
             LEFT JOIN users u ON p.assigned_to = u.id
             WHERE p.id = ?`,
            [id]
        );
        return jobs[0];
    }

    
    async checkJobExists(id) {
        const [existing] = await pool.query('SELECT id FROM production_jobs WHERE id = ?', [id]);
        return existing.length > 0;
    }

   
    async updateJob(id, updateFields, params) {
        params.push(id);
        const updateQuery = `UPDATE production_jobs SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`;
        const [result] = await pool.query(updateQuery, params);
        return result;
    }

    
    async getUpdatedJob(id) {
        const [updatedJob] = await pool.query(
            `SELECT p.*, o.customer_name, u.name as assigned_to_name
             FROM production_jobs p
             LEFT JOIN orders o ON p.order_id = o.id
             LEFT JOIN users u ON p.assigned_to = u.id
             WHERE p.id = ?`,
            [id]
        );
        return updatedJob[0];
    }

    
    async deleteJob(id) {
        await pool.query('DELETE FROM production_jobs WHERE id = ?', [id]);
    }
}

module.exports = ProductionModel;