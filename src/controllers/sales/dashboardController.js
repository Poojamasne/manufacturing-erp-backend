const pool = require('../../config/database');

class DashboardController {
    async getDashboardData(req, res) {
        try {
            // Get dashboard statistics
            const [stats] = await pool.query(`
                SELECT 
                    COUNT(*) as total_leads,
                    SUM(CASE WHEN status = 'Won' THEN 1 ELSE 0 END) as deals_won,
                    SUM(CASE WHEN status = 'Won' THEN expected_value ELSE 0 END) as total_revenue,
                    ROUND(
                        (SUM(CASE WHEN status = 'Won' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2
                    ) as win_rate
                FROM opportunities
                WHERE status IN ('Active', 'Won', 'Lost')
            `);
            
            // Alternative: Calculate from leads table if opportunities not available
            const [leadStats] = await pool.query(`
                SELECT 
                    COUNT(*) as total_leads,
                    SUM(CASE WHEN status = 'Converted' OR status = 'Won' THEN 1 ELSE 0 END) as deals_won,
                    SUM(CASE WHEN status = 'Converted' OR status = 'Won' THEN expected_value ELSE 0 END) as total_revenue,
                    ROUND(
                        (SUM(CASE WHEN status = 'Converted' OR status = 'Won' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2
                    ) as win_rate
                FROM leads
            `);
            
            // Recent leads (last 5)
            const [recentLeads] = await pool.query(`
                SELECT 
                    id,
                    lead_id, 
                    company_name, 
                    contact_person, 
                    status, 
                    priority,
                    expected_value,
                    created_at,
                    DATE_FORMAT(created_at, '%Y-%m-%d') as created_date
                FROM leads
                ORDER BY created_at DESC
                LIMIT 5
            `);
            
            // Pipeline stages (lead status distribution)
            const [pipeline] = await pool.query(`
                SELECT 
                    status as stage, 
                    COUNT(*) as count,
                    ROUND((COUNT(*) / (SELECT COUNT(*) FROM leads)) * 100, 2) as percentage
                FROM leads
                GROUP BY status
                ORDER BY count DESC
            `);
            
            // Sales by product category (from lead_products or order_items)
            const [salesByCategory] = await pool.query(`
                SELECT 
                    COALESCE(p.category, lp.product_name) as category,
                    COUNT(DISTINCT lp.lead_id) as total_orders,
                    SUM(lp.quantity) as units_sold,
                    SUM(lp.total_price) as revenue
                FROM lead_products lp
                LEFT JOIN products p ON lp.product_id = p.id
                GROUP BY COALESCE(p.category, lp.product_name)
                ORDER BY revenue DESC
                LIMIT 5
            `);
            
            // Monthly revenue trend (last 6 months)
            const [monthlyTrend] = await pool.query(`
                SELECT 
                    DATE_FORMAT(created_at, '%Y-%m') as month,
                    COUNT(*) as leads_count,
                    SUM(CASE WHEN status = 'Won' THEN expected_value ELSE 0 END) as revenue
                FROM opportunities
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                ORDER BY month ASC
            `);
            
            // Top performing products
            const [topProducts] = await pool.query(`
                SELECT 
                    lp.product_name,
                    COUNT(DISTINCT lp.lead_id) as lead_count,
                    SUM(lp.quantity) as total_quantity,
                    SUM(lp.total_price) as total_revenue
                FROM lead_products lp
                GROUP BY lp.product_name
                ORDER BY total_revenue DESC
                LIMIT 5
            `);
            
            res.status(200).json({
                success: true,
                data: {
                    stats: {
                        totalLeads: stats[0]?.total_leads || leadStats[0]?.total_leads || 0,
                        dealsWon: stats[0]?.deals_won || leadStats[0]?.deals_won || 0,
                        totalRevenue: parseFloat(stats[0]?.total_revenue || leadStats[0]?.total_revenue || 0),
                        winRate: parseFloat(stats[0]?.win_rate || leadStats[0]?.win_rate || 0)
                    },
                    recentLeads,
                    pipeline,
                    salesByCategory,
                    monthlyTrend,
                    topProducts
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
    
    // Optional: Get detailed stats for charts
    async getDashboardStats(req, res) {
        try {
            const { period = 'monthly' } = req.query;
            
            let dateFormat = '%Y-%m';
            let interval = '6 MONTH';
            
            if (period === 'weekly') {
                dateFormat = '%Y-%u';
                interval = '12 WEEK';
            } else if (period === 'yearly') {
                dateFormat = '%Y';
                interval = '5 YEAR';
            }
            
            // Lead conversion stats
            const [conversionStats] = await pool.query(`
                SELECT 
                    status,
                    COUNT(*) as count,
                    AVG(DATEDIFF(NOW(), created_at)) as avg_age_days
                FROM leads
                GROUP BY status
            `);
            
            // Revenue by priority
            const [revenueByPriority] = await pool.query(`
                SELECT 
                    priority,
                    COUNT(*) as lead_count,
                    SUM(expected_value) as total_value,
                    AVG(expected_value) as avg_value
                FROM opportunities
                WHERE status = 'Won'
                GROUP BY priority
            `);
            
            res.status(200).json({
                success: true,
                data: {
                    conversionStats,
                    revenueByPriority
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
}

module.exports = new DashboardController();