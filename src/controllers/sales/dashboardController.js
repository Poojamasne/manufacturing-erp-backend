const pool = require('../../config/database');

class DashboardController {
    // Helper function to get date range based on filter type
    getDateRange(filter, customStartDate = null, customEndDate = null) {
        const now = new Date();
        let startDate = null;
        let endDate = new Date(); // Default to current date
        
        switch(filter) {
            case 'Weekly':
                // Get start of current week (Sunday)
                startDate = new Date(now);
                startDate.setDate(now.getDate() - now.getDay());
                startDate.setHours(0, 0, 0, 0);
                break;
                
            case 'Monthly':
                // Get start of current month
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
                
            case 'Quarterly':
                // Get start of current quarter
                const quarter = Math.floor(now.getMonth() / 3);
                startDate = new Date(now.getFullYear(), quarter * 3, 1);
                break;
                
            case 'Yearly':
                // Get start of current year
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
                
            case 'Custom':
                if (customStartDate && customEndDate) {
                    startDate = new Date(customStartDate);
                    endDate = new Date(customEndDate);
                    endDate.setHours(23, 59, 59, 999);
                    return { startDate, endDate };
                }
                return { startDate: null, endDate: null };
                
            default:
                return { startDate: null, endDate: null };
        }
        
        if (startDate) {
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
        }
        
        return { startDate, endDate };
    }

    async getDashboardData(req, res) {
        try {
            // Get filter parameters from query string
            const { filter, startDate: customStart, endDate: customEnd } = req.query;
            const { startDate, endDate } = this.getDateRange(filter, customStart, customEnd);
            
            // Base WHERE clause for date filtering
            let dateCondition = '';
            let queryParams = [];
            
            if (startDate && endDate) {
                dateCondition = 'WHERE created_at BETWEEN ? AND ?';
                queryParams = [startDate, endDate];
            }
            
            // 1. Get dashboard statistics from leads table with date filter
            let leadStatsQuery = `
                SELECT 
                    COUNT(*) as total_leads,
                    SUM(CASE WHEN status IN ('Won', 'Converted') THEN 1 ELSE 0 END) as deals_won,
                    ROUND(
                        (SUM(CASE WHEN status IN ('Won', 'Converted') THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2
                    ) as win_rate
                FROM leads
                ${dateCondition}
            `;
            
            const [leadStats] = await pool.query(leadStatsQuery, queryParams);
            
            // 2. Get total revenue from lead_products (for won leads) with date filter
            let revenueQuery = `
                SELECT COALESCE(SUM(lp.total_price), 0) as total_revenue
                FROM lead_products lp
                INNER JOIN leads l ON lp.lead_id = l.id
                WHERE l.status IN ('Won', 'Converted')
                ${startDate && endDate ? 'AND l.created_at BETWEEN ? AND ?' : ''}
            `;
            
            let revenueParams = [];
            if (startDate && endDate) {
                revenueParams = [startDate, endDate];
            }
            
            const [revenueData] = await pool.query(revenueQuery, revenueParams);
            
            // 3. Get total revenue from opportunities that are Won with date filter
            let oppRevenueQuery = `
                SELECT COALESCE(SUM(value), 0) as total_revenue
                FROM opportunities
                WHERE status = 'Won'
                ${startDate && endDate ? 'AND created_at BETWEEN ? AND ?' : ''}
            `;
            
            const [oppRevenueData] = await pool.query(oppRevenueQuery, revenueParams);
            
            // Combine revenue from both sources
            const totalRevenue = parseFloat(revenueData[0]?.total_revenue || 0) + 
                               parseFloat(oppRevenueData[0]?.total_revenue || 0);
            
            // 4. Recent leads (last 5) with date filter
            let recentLeadsQuery = `
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
                ${dateCondition}
                ORDER BY created_at DESC
                LIMIT 5
            `;
            
            const [recentLeads] = await pool.query(recentLeadsQuery, queryParams);
            
            // 5. Pipeline stages (lead status distribution) with date filter
            let pipelineQuery = `
                SELECT 
                    status as stage, 
                    COUNT(*) as count,
                    ROUND((COUNT(*) / (SELECT COUNT(*) FROM leads ${dateCondition})) * 100, 2) as percentage
                FROM leads
                ${dateCondition}
                GROUP BY status
                ORDER BY count DESC
            `;
            
            const [pipeline] = await pool.query(pipelineQuery, queryParams);
            
            // 6. Sales by product category (from lead_products) with date filter
            let salesByCategoryQuery = `
                SELECT 
                    lp.product_name as category,
                    COUNT(DISTINCT lp.lead_id) as total_orders,
                    SUM(lp.quantity) as units_sold,
                    SUM(lp.total_price) as revenue
                FROM lead_products lp
                INNER JOIN leads l ON lp.lead_id = l.id
                ${startDate && endDate ? 'WHERE l.created_at BETWEEN ? AND ?' : ''}
                GROUP BY lp.product_name
                ORDER BY revenue DESC
                LIMIT 5
            `;
            
            const [salesByCategory] = await pool.query(salesByCategoryQuery, revenueParams);
            
            // 7. Opportunity pipeline stages with date filter
            let oppPipelineQuery = `
                SELECT 
                    stage,
                    COUNT(*) as count,
                    ROUND((COUNT(*) / (SELECT COUNT(*) FROM opportunities ${dateCondition})) * 100, 2) as percentage
                FROM opportunities
                ${dateCondition}
                GROUP BY stage
                ORDER BY count DESC
            `;
            
            const [oppPipeline] = await pool.query(oppPipelineQuery, queryParams);
            
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