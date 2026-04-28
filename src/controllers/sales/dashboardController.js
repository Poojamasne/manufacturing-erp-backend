const pool = require('../../config/database');
const { DashboardModel, getDateRange } = require('../../models/sales/dashboardModel');

class DashboardController {
    async getDashboardData(req, res) {
        try {
            const { filter, startDate: customStart, endDate: customEnd } = req.query;
            
            const activeFilter = filter || null;
            
            const { startDate, endDate } = getDateRange(activeFilter, customStart, customEnd);
            
            console.log('Filter:', activeFilter);
            console.log('Date range:', startDate, 'to', endDate);
            
    
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
            
            
            const dashboardModel = new DashboardModel();
            
            // 1. Get dashboard statistics 
            const leadStats = await dashboardModel.getLeadStats(dateCondition, queryParams);
            console.log('Lead Stats Result:', leadStats);
            
            // 2. Get total revenue from lead_products (for won leads) with date filter
            const leadRevenueResult = await dashboardModel.getLeadRevenue(startDate, endDate);
            
            // 3. Get total revenue from opportunities that are Won with date filter
            const oppRevenueResult = await dashboardModel.getOpportunityRevenue(startDate, endDate);
            

            const totalRevenue = parseFloat(leadRevenueResult[0]?.total_revenue || 0) + 
                               parseFloat(oppRevenueResult[0]?.total_revenue || 0);
            
            // 4. Recent leads (last 5) with date filter
            const recentLeads = await dashboardModel.getRecentLeads(dateCondition, queryParams);
            
            // 5. Pipeline stages (lead status distribution) with date filter
            const pipelineResult = await dashboardModel.getPipelineStages(startDate, endDate);
            
            // 6. Sales by product category (from lead_products) with date filter
            const salesByCategoryResult = await dashboardModel.getSalesByCategory(startDate, endDate);
            
            
            const oppPipelineResult = await dashboardModel.getOpportunityPipeline(startDate, endDate);
            
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