const pool = require('../../config/database');

class DashboardController {
    async getDashboardData(req, res) {
        try {
            // 1. Get dashboard statistics from leads table
            const [leadStats] = await pool.query(`
                SELECT 
                    COUNT(*) as total_leads,
                    SUM(CASE WHEN status IN ('Won', 'Converted') THEN 1 ELSE 0 END) as deals_won,
                    ROUND(
                        (SUM(CASE WHEN status IN ('Won', 'Converted') THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2
                    ) as win_rate
                FROM leads
            `);
            
            // 2. Get total revenue from lead_products (for won leads)
            const [revenueData] = await pool.query(`
                SELECT COALESCE(SUM(lp.total_price), 0) as total_revenue
                FROM lead_products lp
                INNER JOIN leads l ON lp.lead_id = l.id
                WHERE l.status IN ('Won', 'Converted')
            `);
            
            // 3. Get total revenue from opportunities that are Won
            const [oppRevenueData] = await pool.query(`
                SELECT COALESCE(SUM(value), 0) as total_revenue
                FROM opportunities
                WHERE status = 'Won'
            `);
            
            // Combine revenue from both sources
            const totalRevenue = parseFloat(revenueData[0]?.total_revenue || 0) + 
                               parseFloat(oppRevenueData[0]?.total_revenue || 0);
            
            // 4. Recent leads (last 5)
            const [recentLeads] = await pool.query(`
                SELECT 
                    id,
                    lead_id, 
                    company_name, 
                    contact_person, 
                    status, 
                    priority,
                    DATE_FORMAT(created_at, '%Y-%m-%d') as created_date,
                    created_at
                FROM leads
                ORDER BY created_at DESC
                LIMIT 5
            `);
            
            // 5. Pipeline stages (lead status distribution)
            const [pipeline] = await pool.query(`
                SELECT 
                    status as stage, 
                    COUNT(*) as count,
                    ROUND((COUNT(*) / (SELECT COUNT(*) FROM leads)) * 100, 2) as percentage
                FROM leads
                GROUP BY status
                ORDER BY count DESC
            `);
            
            // 6. Sales by product category (from lead_products)
            const [salesByCategory] = await pool.query(`
                SELECT 
                    product_name as category,
                    COUNT(DISTINCT lead_id) as total_orders,
                    SUM(quantity) as units_sold,
                    SUM(total_price) as revenue
                FROM lead_products
                GROUP BY product_name
                ORDER BY revenue DESC
                LIMIT 5
            `);
            
            // 7. Opportunity pipeline stages
            const [oppPipeline] = await pool.query(`
                SELECT 
                    stage,
                    COUNT(*) as count,
                    ROUND((COUNT(*) / (SELECT COUNT(*) FROM opportunities)) * 100, 2) as percentage
                FROM opportunities
                GROUP BY stage
                ORDER BY count DESC
            `);
            
            res.status(200).json({
                success: true,
                data: {
                    stats: {
                        totalLeads: leadStats[0]?.total_leads || 0,
                        dealsWon: leadStats[0]?.deals_won || 0,
                        totalRevenue: totalRevenue,
                        winRate: parseFloat(leadStats[0]?.win_rate || 0)
                    },
                    recentLeads: recentLeads || [],
                    pipeline: pipeline || [],
                    salesByCategory: salesByCategory || [],
                    opportunityPipeline: oppPipeline || []
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