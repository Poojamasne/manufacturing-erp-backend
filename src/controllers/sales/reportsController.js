const pool = require('../../config/database');

class ReportsController {
    async getDashboardStats(req, res) {
        try {
            // Get lead statistics
            const [leadStats] = await pool.query(`
                SELECT 
                    COUNT(*) as total_leads,
                    SUM(CASE WHEN status = 'Won' THEN 1 ELSE 0 END) as won_deals,
                    SUM(CASE WHEN status = 'New' THEN 1 ELSE 0 END) as new_leads,
                    SUM(CASE WHEN status = 'Quotation' THEN 1 ELSE 0 END) as quotation_stage
                FROM leads
            `);
            
            // Get order statistics
            const [orderStats] = await pool.query(`
                SELECT 
                    COUNT(*) as total_orders,
                    SUM(CASE WHEN status = 'Processing' THEN 1 ELSE 0 END) as processing_orders,
                    SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_orders,
                    COALESCE(SUM(total_amount), 0) as total_revenue
                FROM orders
            `);
            
            // Get production statistics
            const [prodStats] = await pool.query(`
                SELECT 
                    COUNT(*) as total_jobs,
                    SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress
                FROM production_jobs
            `);
            
            res.status(200).json({
                success: true,
                data: {
                    leads: leadStats[0],
                    orders: orderStats[0],
                    production: prodStats[0]
                }
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching dashboard stats',
                error: error.message
            });
        }
    }
    
    async getRevenueTrend(req, res) {
        try {
            const [revenue] = await pool.query(`
                SELECT 
                    DATE_FORMAT(order_date, '%Y-%m') as month,
                    COALESCE(SUM(total_amount), 0) as revenue
                FROM orders
                WHERE status != 'Cancelled'
                GROUP BY DATE_FORMAT(order_date, '%Y-%m')
                ORDER BY month DESC
                LIMIT 6
            `);
            
            res.status(200).json({
                success: true,
                data: revenue.reverse()
            });
        } catch (error) {
            console.error('Error fetching revenue trend:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching revenue trend',
                error: error.message
            });
        }
    }
    
    async getSalesLeaderboard(req, res) {
        try {
            const [leaderboard] = await pool.query(`
                SELECT 
                    u.name,
                    COUNT(DISTINCT l.id) as leads,
                    COUNT(DISTINCT o.id) as opportunities,
                    COUNT(DISTINCT ord.id) as orders,
                    COALESCE(SUM(ord.total_amount), 0) as revenue
                FROM users u
                LEFT JOIN leads l ON l.assigned_to = u.id
                LEFT JOIN opportunities o ON o.assigned_to = u.id
                LEFT JOIN orders ord ON ord.sales_rep_id = u.id
                WHERE u.role IN ('salesperson', 'manager')
                GROUP BY u.id
                ORDER BY revenue DESC
                LIMIT 5
            `);
            
            res.status(200).json({
                success: true,
                data: leaderboard
            });
        } catch (error) {
            console.error('Error fetching sales leaderboard:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching sales leaderboard',
                error: error.message
            });
        }
    }
}

module.exports = new ReportsController();