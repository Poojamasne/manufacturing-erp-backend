const pool = require('../../config/database');

// Helper function to get date range based on filter type
function getDateRange(filter, customStartDate = null, customEndDate = null) {
    const now = new Date();
    let startDate = null;
    let endDate = new Date();
    
    switch(filter) {
        case 'Weekly':
            // Get start of current week (Sunday)
            startDate = new Date(now);
            startDate.setDate(now.getDate() - now.getDay());
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'Monthly':
            // Get start of current month
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'Quarterly':
            // Get start of current quarter
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'Yearly':
            // Get start of current year
            startDate = new Date(now.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'Custom':
            if (customStartDate && customEndDate) {
                startDate = new Date(customStartDate);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(customEndDate);
                endDate.setHours(23, 59, 59, 999);
                return { startDate, endDate };
            }
            return { startDate: null, endDate: null };
            
        default:
            return { startDate: null, endDate: null };
    }
    
    return { startDate, endDate };
}

class DashboardController {
    async getDashboardData(req, res) {
        try {
            // Get filter parameters from query string
            const { filter, startDate: customStart, endDate: customEnd } = req.query;
            
            // Default to Weekly if no filter provided
            const activeFilter = filter || 'Weekly';
            
            // Get date range using the helper function
            const { startDate, endDate } = getDateRange(activeFilter, customStart, customEnd);
            
            // Prepare query parameters for date filtering
            let queryParams = [];
            let dateCondition = '';
            let dateConditionForCount = '';
            
            if (startDate && endDate) {
                dateCondition = 'WHERE created_at BETWEEN ? AND ?';
                dateConditionForCount = `WHERE created_at BETWEEN '${startDate.toISOString().slice(0, 19).replace('T', ' ')}' AND '${endDate.toISOString().slice(0, 19).replace('T', ' ')}'`;
                queryParams = [startDate, endDate];
            }
            
            // 1. Get dashboard statistics from leads table with date filter
            let leadStatsQuery = `
                SELECT 
                    COUNT(*) as total_leads,
                    SUM(CASE WHEN status IN ('Won', 'Converted') THEN 1 ELSE 0 END) as deals_won,
                    CASE 
                        WHEN COUNT(*) > 0 
                        THEN ROUND((SUM(CASE WHEN status IN ('Won', 'Converted') THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2)
                        ELSE 0
                    END as win_rate
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
            `;
            
            let revenueParams = [];
            if (startDate && endDate) {
                revenueQuery += ' AND l.created_at BETWEEN ? AND ?';
                revenueParams = [startDate, endDate];
            }
            
            const [revenueData] = await pool.query(revenueQuery, revenueParams);
            
            // 3. Get total revenue from opportunities that are Won with date filter
            let oppRevenueQuery = `
                SELECT COALESCE(SUM(value), 0) as total_revenue
                FROM opportunities
                WHERE status = 'Won'
            `;
            
            let oppRevenueParams = [];
            if (startDate && endDate) {
                oppRevenueQuery += ' AND created_at BETWEEN ? AND ?';
                oppRevenueParams = [startDate, endDate];
            }
            
            const [oppRevenueData] = await pool.query(oppRevenueQuery, oppRevenueParams);
            
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
            let pipelineQuery;
            let pipelineResult;
            
            if (startDate && endDate) {
                // Get total count for percentage calculation
                const [totalCountResult] = await pool.query(`SELECT COUNT(*) as total FROM leads ${dateCondition}`, queryParams);
                const totalCount = totalCountResult[0].total;
                
                pipelineQuery = `
                    SELECT 
                        status as stage, 
                        COUNT(*) as count,
                        ROUND((COUNT(*) / ?) * 100, 2) as percentage
                    FROM leads
                    ${dateCondition}
                    GROUP BY status
                    ORDER BY count DESC
                `;
                [pipelineResult] = await pool.query(pipelineQuery, [...queryParams, totalCount]);
            } else {
                pipelineQuery = `
                    SELECT 
                        status as stage, 
                        COUNT(*) as count,
                        ROUND((COUNT(*) / (SELECT COUNT(*) FROM leads)) * 100, 2) as percentage
                    FROM leads
                    GROUP BY status
                    ORDER BY count DESC
                `;
                [pipelineResult] = await pool.query(pipelineQuery);
            }
            
            // 6. Sales by product category (from lead_products) with date filter
            let salesByCategoryQuery = `
                SELECT 
                    lp.product_name as category,
                    COUNT(DISTINCT lp.lead_id) as total_orders,
                    SUM(lp.quantity) as units_sold,
                    SUM(lp.total_price) as revenue
                FROM lead_products lp
                INNER JOIN leads l ON lp.lead_id = l.id
            `;
            
            let salesByCategoryResult = [];
            if (startDate && endDate) {
                salesByCategoryQuery += ' WHERE l.created_at BETWEEN ? AND ?';
                salesByCategoryQuery += ' GROUP BY lp.product_name ORDER BY revenue DESC LIMIT 5';
                const [salesByCategory] = await pool.query(salesByCategoryQuery, revenueParams);
                salesByCategoryResult = salesByCategory;
            } else {
                salesByCategoryQuery += ' GROUP BY lp.product_name ORDER BY revenue DESC LIMIT 5';
                const [salesByCategory] = await pool.query(salesByCategoryQuery);
                salesByCategoryResult = salesByCategory;
            }
            
            // 7. Opportunity pipeline stages with date filter
            let oppPipelineQuery;
            let oppPipelineResult;
            
            if (startDate && endDate) {
                // Get total count for percentage calculation
                const [totalOppCountResult] = await pool.query(`SELECT COUNT(*) as total FROM opportunities ${dateCondition}`, queryParams);
                const totalOppCount = totalOppCountResult[0].total;
                
                oppPipelineQuery = `
                    SELECT 
                        stage,
                        COUNT(*) as count,
                        ROUND((COUNT(*) / ?) * 100, 2) as percentage
                    FROM opportunities
                    ${dateCondition}
                    GROUP BY stage
                    ORDER BY count DESC
                `;
                [oppPipelineResult] = await pool.query(oppPipelineQuery, [...queryParams, totalOppCount]);
            } else {
                oppPipelineQuery = `
                    SELECT 
                        stage,
                        COUNT(*) as count,
                        ROUND((COUNT(*) / (SELECT COUNT(*) FROM opportunities)) * 100, 2) as percentage
                    FROM opportunities
                    GROUP BY stage
                    ORDER BY count DESC
                `;
                [oppPipelineResult] = await pool.query(oppPipelineQuery);
            }
            
            // Send success response
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
                    pipeline: pipelineResult || [],
                    salesByCategory: salesByCategoryResult || [],
                    opportunityPipeline: oppPipelineResult || []
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