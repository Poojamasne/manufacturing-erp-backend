const pool = require('../../config/database');

class DashboardController {
    async getDashboardData(req, res) {
        try {
            // Recent leads
            const [recentLeads] = await pool.query(`
                SELECT lead_id, company_name, contact_person, status, created_at
                FROM leads
                ORDER BY created_at DESC
                LIMIT 5
            `);
            
            // Pipeline stages
            const [pipeline] = await pool.query(`
                SELECT status as stage, COUNT(*) as count
                FROM leads
                GROUP BY status
            `);
            
            // Sales by category
            const [salesByCategory] = await pool.query(`
                SELECT product_name as category, SUM(quantity) as units_sold, SUM(total_price) as revenue
                FROM order_items
                GROUP BY product_name
                LIMIT 5
            `);
            
            res.status(200).json({
                success: true,
                data: {
                    recentLeads,
                    pipeline,
                    salesByCategory
                }
            });
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching dashboard data',
                error: error.message
            });
        }
    }
}

module.exports = new DashboardController();