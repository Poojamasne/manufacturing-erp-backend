const pool = require('../../config/database');

// Helper function to get date range based on filter type
function getDateRange(filter, customStartDate = null, customEndDate = null) {
    const now = new Date();
    let startDate = null;
    let endDate = null;
    
    switch(filter) {
        case 'Weekly':
            // Get start of current week (Monday)
            const monday = new Date(now);
            monday.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
            monday.setHours(0, 0, 0, 0);
            startDate = monday;
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'Monthly':
            // Get start of current month
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'Quarterly':
            // Get start of current quarter
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'Yearly':
            // Get start of current year
            startDate = new Date(now.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'Custom':
            if (customStartDate && customEndDate) {
                startDate = new Date(customStartDate);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(customEndDate);
                endDate.setHours(23, 59, 59, 999);
            }
            break;
            
        default:
            // No filter - return null for both (get all data)
            return { startDate: null, endDate: null };
    }
    
    return { startDate, endDate };
}

class DashboardController {
    async getDashboardData(req, res) {
        try {
            // Get filter parameters from query string
            const { filter, startDate: customStart, endDate: customEnd } = req.query;
            
            // Default to null (no filter) if no filter provided
            const activeFilter = filter || null;
            
            // Get date range using the helper function
            const { startDate, endDate } = getDateRange(activeFilter, customStart, customEnd);
            
            console.log('Filter:', activeFilter);
            console.log('Date range:', startDate, 'to', endDate);
            
            // Prepare query parameters for date filtering
            let queryParams = [];
            let dateCondition = '';
            
            if (startDate && endDate) {
                // Convert dates to MySQL datetime format
                const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
                const endDateStr = endDate.toISOString().slice(0, 19).replace('T', ' ');
                dateCondition = 'WHERE created_at BETWEEN ? AND ?';
                queryParams = [startDateStr, endDateStr];
                console.log('Date condition with:', startDateStr, endDateStr);
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
            
            console.log('Lead Stats Query:', leadStatsQuery);
            console.log('Query Params:', queryParams);
            
            const [leadStats] = await pool.query(leadStatsQuery, queryParams);
            console.log('Lead Stats Result:', leadStats);
            
            // 2. Get total revenue from lead_products (for won leads) with date filter
            let revenueQuery = `
                SELECT COALESCE(SUM(lp.total_price), 0) as total_revenue
                FROM lead_products lp
                INNER JOIN leads l ON lp.lead_id = l.id
                WHERE l.status IN ('Won', 'Converted')
            `;
            
            let revenueResult;
            if (startDate && endDate) {
                const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
                const endDateStr = endDate.toISOString().slice(0, 19).replace('T', ' ');
                revenueQuery += ' AND l.created_at BETWEEN ? AND ?';
                const [revenueData] = await pool.query(revenueQuery, [startDateStr, endDateStr]);
                revenueResult = revenueData;
            } else {
                const [revenueData] = await pool.query(revenueQuery);
                revenueResult = revenueData;
            }
            
            // 3. Get total revenue from opportunities that are Won with date filter
            let oppRevenueQuery = `
                SELECT COALESCE(SUM(value), 0) as total_revenue
                FROM opportunities
                WHERE status = 'Won'
            `;
            
            let oppRevenueResult;
            if (startDate && endDate) {
                const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
                const endDateStr = endDate.toISOString().slice(0, 19).replace('T', ' ');
                oppRevenueQuery += ' AND created_at BETWEEN ? AND ?';
                const [oppRevenueData] = await pool.query(oppRevenueQuery, [startDateStr, endDateStr]);
                oppRevenueResult = oppRevenueData;
            } else {
                const [oppRevenueData] = await pool.query(oppRevenueQuery);
                oppRevenueResult = oppRevenueData;
            }
            
            // Combine revenue from both sources
            const totalRevenue = parseFloat(revenueResult[0]?.total_revenue || 0) + 
                               parseFloat(oppRevenueResult[0]?.total_revenue || 0);
            
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
            let pipelineResult = [];
            if (startDate && endDate) {
                const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
                const endDateStr = endDate.toISOString().slice(0, 19).replace('T', ' ');
                
                // Get total count for percentage calculation
                const [totalCountResult] = await pool.query(`SELECT COUNT(*) as total FROM leads WHERE created_at BETWEEN ? AND ?`, [startDateStr, endDateStr]);
                const totalCount = totalCountResult[0].total;
                
                if (totalCount > 0) {
                    const pipelineQuery = `
                        SELECT 
                            status as stage, 
                            COUNT(*) as count,
                            ROUND((COUNT(*) / ?) * 100, 2) as percentage
                        FROM leads
                        WHERE created_at BETWEEN ? AND ?
                        GROUP BY status
                        ORDER BY count DESC
                    `;
                    [pipelineResult] = await pool.query(pipelineQuery, [totalCount, startDateStr, endDateStr]);
                }
            } else {
                const [totalCountResult] = await pool.query(`SELECT COUNT(*) as total FROM leads`);
                const totalCount = totalCountResult[0].total;
                
                if (totalCount > 0) {
                    const pipelineQuery = `
                        SELECT 
                            status as stage, 
                            COUNT(*) as count,
                            ROUND((COUNT(*) / ?) * 100, 2) as percentage
                        FROM leads
                        GROUP BY status
                        ORDER BY count DESC
                    `;
                    [pipelineResult] = await pool.query(pipelineQuery, [totalCount]);
                }
            }
            
            // 6. Sales by product category (from lead_products) with date filter
            let salesByCategoryResult = [];
            if (startDate && endDate) {
                const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
                const endDateStr = endDate.toISOString().slice(0, 19).replace('T', ' ');
                
                const salesByCategoryQuery = `
                    SELECT 
                        lp.product_name as category,
                        COUNT(DISTINCT lp.lead_id) as total_orders,
                        SUM(lp.quantity) as units_sold,
                        SUM(lp.total_price) as revenue
                    FROM lead_products lp
                    INNER JOIN leads l ON lp.lead_id = l.id
                    WHERE l.created_at BETWEEN ? AND ?
                    GROUP BY lp.product_name
                    ORDER BY revenue DESC
                    LIMIT 5
                `;
                const [salesByCategory] = await pool.query(salesByCategoryQuery, [startDateStr, endDateStr]);
                salesByCategoryResult = salesByCategory;
            } else {
                const salesByCategoryQuery = `
                    SELECT 
                        product_name as category,
                        COUNT(DISTINCT lead_id) as total_orders,
                        SUM(quantity) as units_sold,
                        SUM(total_price) as revenue
                    FROM lead_products
                    GROUP BY product_name
                    ORDER BY revenue DESC
                    LIMIT 5
                `;
                const [salesByCategory] = await pool.query(salesByCategoryQuery);
                salesByCategoryResult = salesByCategory;
            }
            
            // 7. Opportunity pipeline stages with date filter
            let oppPipelineResult = [];
            if (startDate && endDate) {
                const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
                const endDateStr = endDate.toISOString().slice(0, 19).replace('T', ' ');
                
                // Get total count for percentage calculation
                const [totalOppCountResult] = await pool.query(`SELECT COUNT(*) as total FROM opportunities WHERE created_at BETWEEN ? AND ?`, [startDateStr, endDateStr]);
                const totalOppCount = totalOppCountResult[0].total;
                
                if (totalOppCount > 0) {
                    const oppPipelineQuery = `
                        SELECT 
                            stage,
                            COUNT(*) as count,
                            ROUND((COUNT(*) / ?) * 100, 2) as percentage
                        FROM opportunities
                        WHERE created_at BETWEEN ? AND ?
                        GROUP BY stage
                        ORDER BY count DESC
                    `;
                    [oppPipelineResult] = await pool.query(oppPipelineQuery, [totalOppCount, startDateStr, endDateStr]);
                }
            } else {
                const [totalOppCountResult] = await pool.query(`SELECT COUNT(*) as total FROM opportunities`);
                const totalOppCount = totalOppCountResult[0].total;
                
                if (totalOppCount > 0) {
                    const oppPipelineQuery = `
                        SELECT 
                            stage,
                            COUNT(*) as count,
                            ROUND((COUNT(*) / ?) * 100, 2) as percentage
                        FROM opportunities
                        GROUP BY stage
                        ORDER BY count DESC
                    `;
                    [oppPipelineResult] = await pool.query(oppPipelineQuery, [totalOppCount]);
                }
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