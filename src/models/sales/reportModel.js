const pool = require('../../config/database');

class ReportModel {
    
    async getRevenueData(range, startDate, endDate) {
        let dateCondition = '';
        let dateParams = [];
        let revenueQuery = '';
        
        if (range === 'Weekly') {
            dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
            revenueQuery = `
                SELECT 
                    DATE_FORMAT(created_at, '%a') as name,
                    CAST(COALESCE(SUM(total_amount), 0) AS DECIMAL(10,2)) as val
                FROM orders
                WHERE status = 'Delivered' ${dateCondition}
                GROUP BY DAYOFWEEK(created_at)
                ORDER BY DAYOFWEEK(created_at) ASC
            `;
        } 
        else if (range === 'Monthly') {
            dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
            revenueQuery = `
                SELECT 
                    DATE_FORMAT(created_at, '%Y-%m-%d') as name,
                    CAST(COALESCE(SUM(total_amount), 0) AS DECIMAL(10,2)) as val
                FROM orders
                WHERE status = 'Delivered' ${dateCondition}
                GROUP BY DATE(created_at)
                ORDER BY created_at ASC
            `;
        } 
        else if (range === 'Quarterly') {
            dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
            revenueQuery = `
                SELECT 
                    DATE_FORMAT(created_at, '%b') as name,
                    CAST(COALESCE(SUM(total_amount), 0) AS DECIMAL(10,2)) as val
                FROM orders
                WHERE status = 'Delivered' ${dateCondition}
                GROUP BY MONTH(created_at)
                ORDER BY MONTH(created_at) ASC
            `;
        } 
        else if (range === 'Yearly') {
            dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
            revenueQuery = `
                SELECT 
                    DATE_FORMAT(created_at, '%Y') as name,
                    CAST(COALESCE(SUM(total_amount), 0) AS DECIMAL(10,2)) as val
                FROM orders
                WHERE status = 'Delivered' ${dateCondition}
                GROUP BY YEAR(created_at)
                ORDER BY YEAR(created_at) ASC
            `;
        } 
        else if (range === 'Custom' && startDate && endDate) {
            dateCondition = `AND DATE(created_at) BETWEEN ? AND ?`;
            dateParams = [startDate, endDate];
            revenueQuery = `
                SELECT 
                    DATE_FORMAT(created_at, '%Y-%m-%d') as name,
                    CAST(COALESCE(SUM(total_amount), 0) AS DECIMAL(10,2)) as val
                FROM orders
                WHERE status = 'Delivered' ${dateCondition}
                GROUP BY DATE(created_at)
                ORDER BY created_at ASC
                LIMIT 30
            `;
        }
        
        if (!revenueQuery) {
            throw new Error(`No query defined for range: ${range}`);
        }
        
        const [revenueData] = await pool.query(revenueQuery, dateParams);
        return { revenueData, dateCondition, dateParams };
    }

    async getLeadSources() {
        const [sourceData] = await pool.query(`
            SELECT 
                COALESCE(lead_source, 'Other') as name,
                COUNT(*) as value
            FROM leads
            GROUP BY lead_source
            ORDER BY value DESC
        `);
        return sourceData;
    }

    async getKPIStats(dateCondition, dateParams) {
        let ordersQuery = `
            SELECT 
                CAST(COALESCE(SUM(total_amount), 0) AS DECIMAL(10,2)) as total_revenue,
                COUNT(*) as total_orders,
                COALESCE(AVG(total_amount), 0) as avg_order_value
            FROM orders
            WHERE status = 'Delivered' ${dateCondition}
        `;
        
        const [ordersResult] = await pool.query(ordersQuery, dateParams);
        return ordersResult[0];
    }


    async getTotalLeads() {
        const [totalLeadsResult] = await pool.query(`
            SELECT COUNT(DISTINCT id) as total_leads FROM leads
        `);
        return parseInt(totalLeadsResult[0]?.total_leads || 0);
    }

    async getProductPerformance(dateCondition, dateParams) {
        let productQuery = `
            SELECT 
                oi.product_name as name,
                CAST(COALESCE(SUM(oi.quantity), 0) AS UNSIGNED) as sold
            FROM order_items oi
            INNER JOIN orders o ON oi.order_id = o.id
            WHERE o.status = 'Delivered' ${dateCondition.replace(/created_at/g, 'o.created_at')}
            GROUP BY oi.product_name
            ORDER BY sold DESC
            LIMIT 5
        `;
        
        const [productData] = await pool.query(productQuery, dateParams);
        return productData;
    }

    async getSalesLeaderboard(dateCondition, dateParams) {
        let leaderboardQuery = `
            SELECT 
                COALESCE(u.name, 'Unassigned') as name,
                COUNT(DISTINCT l.id) as leads,
                CAST(COALESCE(SUM(o.total_amount), 0) AS DECIMAL(10,2)) as revenue
            FROM leads l
            LEFT JOIN orders o ON l.company_name = o.customer_name AND o.status = 'Delivered' ${dateCondition.replace(/created_at/g, 'o.created_at')}
            LEFT JOIN users u ON l.assigned_to = u.id
            GROUP BY l.assigned_to, u.name
            ORDER BY revenue DESC
            LIMIT 10
        `;
        
        const [leaderboardData] = await pool.query(leaderboardQuery, dateParams);
        return leaderboardData;
    }

    async getExportData(range, startDate, endDate) {
        let dateCondition = '';
        let dateParams = [];
        
        if (range === 'Weekly') {
            dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
        } else if (range === 'Monthly') {
            dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
        } else if (range === 'Quarterly') {
            dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
        } else if (range === 'Yearly') {
            dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
        } else if (range === 'Custom' && startDate && endDate) {
            dateCondition = `AND DATE(created_at) BETWEEN ? AND ?`;
            dateParams = [startDate, endDate];
        } else {
            dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
        }
        
        const [ordersData] = await pool.query(`
            SELECT 
                order_id,
                customer_name,
                total_amount,
                DATE_FORMAT(created_at, '%Y-%m-%d') as created_date
            FROM orders
            WHERE status = 'Delivered' ${dateCondition}
            ORDER BY created_at DESC
        `, dateParams);
        
        return ordersData;
    }
}

module.exports = ReportModel;