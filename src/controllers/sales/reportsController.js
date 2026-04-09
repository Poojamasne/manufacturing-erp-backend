const pool = require('../../config/database');

class ReportsController {
    async getReportData(req, res) {
        try {
            const { range = 'Monthly', startDate, endDate } = req.query;
            
            // Build date condition - USING opportunities table directly for revenue
            let dateCondition = '';
            let revenueDateCondition = '';
            let leadDateCondition = '';
            let dateParams = [];
            let revenueDateParams = [];
            let leadDateParams = [];
            
            if (range === 'Weekly') {
                dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
                revenueDateCondition = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
                leadDateCondition = `AND l.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
            } else if (range === 'Monthly') {
                dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
                revenueDateCondition = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
                leadDateCondition = `AND l.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
            } else if (range === 'Quarterly') {
                dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
                revenueDateCondition = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
                leadDateCondition = `AND l.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
            } else if (range === 'Yearly') {
                dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
                revenueDateCondition = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
                leadDateCondition = `AND l.created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
            } else if (range === 'Custom' && startDate && endDate) {
                dateCondition = `AND DATE(created_at) BETWEEN ? AND ?`;
                revenueDateCondition = `AND DATE(o.created_at) BETWEEN ? AND ?`;
                leadDateCondition = `AND DATE(l.created_at) BETWEEN ? AND ?`;
                dateParams = [startDate, endDate];
                revenueDateParams = [startDate, endDate];
                leadDateParams = [startDate, endDate];
            }
            
            // 1. Get Revenue Trend Data - Using opportunities table directly
            let revenueQuery = '';
            
            if (range === 'Weekly') {
                revenueQuery = `
                    SELECT 
                        DATE_FORMAT(o.created_at, '%a') as name,
                        CAST(COALESCE(SUM(o.value), 0) AS DECIMAL(10,2)) as val
                    FROM opportunities o
                    WHERE o.status = 'Won' ${revenueDateCondition}
                    GROUP BY DAYOFWEEK(o.created_at)
                    ORDER BY DAYOFWEEK(o.created_at) ASC
                `;
            } else if (range === 'Monthly') {
                revenueQuery = `
                    SELECT 
                        CONCAT('W', WEEK(o.created_at, 1) - WEEK(DATE_SUB(o.created_at, INTERVAL DAYOFMONTH(o.created_at)-1 DAY), 1) + 1) as name,
                        CAST(COALESCE(SUM(o.value), 0) AS DECIMAL(10,2)) as val
                    FROM opportunities o
                    WHERE o.status = 'Won' ${revenueDateCondition}
                    GROUP BY WEEK(o.created_at)
                    ORDER BY MIN(o.created_at) ASC
                `;
            } else if (range === 'Quarterly') {
                revenueQuery = `
                    SELECT 
                        DATE_FORMAT(o.created_at, '%b') as name,
                        CAST(COALESCE(SUM(o.value), 0) AS DECIMAL(10,2)) as val
                    FROM opportunities o
                    WHERE o.status = 'Won' ${revenueDateCondition}
                    GROUP BY MONTH(o.created_at)
                    ORDER BY MONTH(o.created_at) ASC
                `;
            } else if (range === 'Yearly') {
                revenueQuery = `
                    SELECT 
                        DATE_FORMAT(o.created_at, '%Y') as name,
                        CAST(COALESCE(SUM(o.value), 0) AS DECIMAL(10,2)) as val
                    FROM opportunities o
                    WHERE o.status = 'Won' ${revenueDateCondition}
                    GROUP BY YEAR(o.created_at)
                    ORDER BY YEAR(o.created_at) ASC
                `;
            } else {
                revenueQuery = `
                    SELECT 
                        DATE_FORMAT(o.created_at, '%Y-%m-%d') as name,
                        CAST(COALESCE(SUM(o.value), 0) AS DECIMAL(10,2)) as val
                    FROM opportunities o
                    WHERE o.status = 'Won' ${revenueDateCondition}
                    GROUP BY DATE(o.created_at)
                    ORDER BY o.created_at ASC
                    LIMIT 30
                `;
            }
            
            const [revenueData] = await pool.query(revenueQuery, revenueDateParams);
            
            // Convert val to number
            const formattedRevenueData = revenueData.map(item => ({
                name: item.name,
                val: parseFloat(item.val) || 0
            }));
            
            // 2. Get Lead Sources Distribution
            const [sourceData] = await pool.query(`
                SELECT 
                    COALESCE(l.lead_source, 'Other') as name,
                    COUNT(*) as value
                FROM leads l
                WHERE 1=1 ${leadDateCondition}
                GROUP BY l.lead_source
                ORDER BY value DESC
            `, leadDateParams);
            
            // 3. Get KPI Statistics
            const [kpiData] = await pool.query(`
                SELECT 
                    CAST(COALESCE(SUM(o.value), 0) AS DECIMAL(10,2)) as total_revenue,
                    COUNT(DISTINCT l.id) as total_leads,
                    COUNT(DISTINCT CASE WHEN o.status = 'Won' THEN o.id END) as won_deals,
                    ROUND(
                        IFNULL(
                            (COUNT(DISTINCT CASE WHEN o.status = 'Won' THEN o.id END) / NULLIF(COUNT(DISTINCT l.id), 0)) * 100, 0
                        ), 2
                    ) as conversion_rate,
                    ROUND(
                        IFNULL(AVG(o.value), 0), 2
                    ) as avg_deal_value
                FROM leads l
                LEFT JOIN opportunities o ON l.id = o.lead_id
                WHERE 1=1 ${leadDateCondition}
            `, leadDateParams);
            
            // Format KPIs for frontend display
            const totalRevenue = parseFloat(kpiData[0]?.total_revenue || 0);
            const totalLeads = parseInt(kpiData[0]?.total_leads || 0);
            const wonDeals = parseInt(kpiData[0]?.won_deals || 0);
            const conversionRate = parseFloat(kpiData[0]?.conversion_rate || 0);
            const avgDealValue = parseFloat(kpiData[0]?.avg_deal_value || 0);
            
            // Format revenue in Lakhs/Crores
            let formattedRevenue = '₹0';
            if (totalRevenue >= 10000000) {
                formattedRevenue = `₹${(totalRevenue / 10000000).toFixed(1)}Cr`;
            } else if (totalRevenue >= 100000) {
                formattedRevenue = `₹${(totalRevenue / 100000).toFixed(1)}L`;
            } else if (totalRevenue >= 1000) {
                formattedRevenue = `₹${(totalRevenue / 1000).toFixed(1)}K`;
            } else if (totalRevenue > 0) {
                formattedRevenue = `₹${totalRevenue.toFixed(0)}`;
            }
            
            // Format leads
            let formattedLeads = totalLeads.toString();
            if (totalLeads >= 1000) {
                formattedLeads = `${(totalLeads / 1000).toFixed(1)}K`;
            }
            
            // Format avg deal value
            let formattedAvgValue = '₹0';
            if (avgDealValue >= 100000) {
                formattedAvgValue = `₹${(avgDealValue / 100000).toFixed(1)}L`;
            } else if (avgDealValue >= 1000) {
                formattedAvgValue = `₹${(avgDealValue / 1000).toFixed(1)}K`;
            } else if (avgDealValue > 0) {
                formattedAvgValue = `₹${avgDealValue.toFixed(0)}`;
            }
            
            // 4. Get Product Performance from orders (better than lead_products)
            const [productData] = await pool.query(`
                SELECT 
                    oi.product_name as name,
                    CAST(COALESCE(SUM(oi.quantity), 0) AS UNSIGNED) as sold,
                    CAST(COALESCE(SUM(oi.total_price), 0) AS DECIMAL(10,2)) as revenue,
                    COUNT(DISTINCT oi.order_id) as orders
                FROM order_items oi
                INNER JOIN orders o ON oi.order_id = o.id
                WHERE 1=1 ${dateCondition}
                GROUP BY oi.product_name
                ORDER BY sold DESC
                LIMIT 5
            `, dateParams);
            
            // Add target and production, ensure sold is number
            const productsWithTargets = productData.map(product => ({
                name: product.name.length > 15 ? product.name.substring(0, 12) + '...' : product.name,
                sold: parseInt(product.sold) || 0,
                target: Math.round((parseInt(product.sold) || 0) * 1.2),
                prod: Math.round((parseInt(product.sold) || 0) * 1.1)
            }));
            
            // 5. Get Sales Leaderboard
            const [leaderboardData] = await pool.query(`
                SELECT 
                    COALESCE(u.name, 'Unassigned') as name,
                    COUNT(DISTINCT l.id) as leads,
                    COUNT(DISTINCT CASE WHEN o.status = 'Won' THEN o.id END) as won_deals,
                    ROUND(
                        IFNULL(
                            (COUNT(DISTINCT CASE WHEN o.status = 'Won' THEN o.id END) / NULLIF(COUNT(DISTINCT l.id), 0)) * 100, 0
                        ), 1
                    ) as conversion,
                    CAST(COALESCE(SUM(o.value), 0) AS DECIMAL(10,2)) as revenue
                FROM leads l
                LEFT JOIN opportunities o ON l.id = o.lead_id
                LEFT JOIN users u ON l.assigned_to = u.id
                WHERE 1=1 ${leadDateCondition}
                GROUP BY l.assigned_to, u.name
                ORDER BY revenue DESC
                LIMIT 10
            `, leadDateParams);
            
            // Remove duplicates by using a Map
            const uniqueLeaderboard = new Map();
            leaderboardData.forEach(rep => {
                const key = rep.name;
                if (!uniqueLeaderboard.has(key) || uniqueLeaderboard.get(key).revenue < rep.revenue) {
                    uniqueLeaderboard.set(key, rep);
                }
            });
            
            // Format leaderboard data
            const formattedLeaderboard = Array.from(uniqueLeaderboard.values()).map(rep => ({
                name: rep.name || 'Unassigned',
                leads: parseInt(rep.leads) || 0,
                conversion: `${parseFloat(rep.conversion) || 0}%`,
                revenue: `₹${((parseFloat(rep.revenue) || 0) / 100000).toFixed(1)}L`
            }));
            
            // If no data, provide default structure
            const finalRevenueData = formattedRevenueData.length > 0 ? formattedRevenueData : [{ name: 'No Data', val: 0 }];
            const finalSourceData = sourceData.length > 0 ? sourceData : [{ name: 'No Data', value: 100 }];
            const finalProductsData = productsWithTargets.length > 0 ? productsWithTargets : [{ name: 'No Data', sold: 0, target: 0, prod: 0 }];
            const finalLeaderboard = formattedLeaderboard.length > 0 ? formattedLeaderboard : [{ name: 'No Data', leads: 0, conversion: '0%', revenue: '₹0' }];
            
            res.status(200).json({
                success: true,
                data: {
                    revenue: finalRevenueData,
                    sources: finalSourceData,
                    kpis: {
                        rev: formattedRevenue,
                        leads: formattedLeads,
                        conv: `${conversionRate}%`,
                        avg: formattedAvgValue
                    },
                    products: finalProductsData,
                    leaderboard: finalLeaderboard
                }
            });
        } catch (error) {
            console.error('Error fetching report data:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching report data',
                error: error.message
            });
        }
    }
    
    // Export report as CSV
    async exportReport(req, res) {
        try {
            const { range = 'Monthly', startDate, endDate } = req.query;
            
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
            }
            
            // Export orders data instead of leads for better reporting
            const [ordersData] = await pool.query(`
                SELECT 
                    o.order_id,
                    o.customer_name,
                    o.email,
                    o.phone,
                    o.status,
                    o.total_amount,
                    DATE_FORMAT(o.created_at, '%Y-%m-%d') as created_date,
                    u.name as sales_rep_name
                FROM orders o
                LEFT JOIN users u ON o.sales_rep_id = u.id
                WHERE 1=1 ${dateCondition}
                ORDER BY o.created_at DESC
            `, dateParams);
            
            if (ordersData.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No data found for export'
                });
            }
            
            const headers = ['Order ID', 'Customer Name', 'Email', 'Phone', 'Status', 'Total Amount', 'Created Date', 'Sales Rep'];
            const csvRows = [headers.join(',')];
            
            for (const row of ordersData) {
                const values = [
                    `"${(row.order_id || '').replace(/"/g, '""')}"`,
                    `"${(row.customer_name || '').replace(/"/g, '""')}"`,
                    `"${(row.email || '').replace(/"/g, '""')}"`,
                    `"${(row.phone || '').replace(/"/g, '""')}"`,
                    `"${(row.status || '').replace(/"/g, '""')}"`,
                    `${row.total_amount || 0}`,
                    `"${(row.created_date || '').replace(/"/g, '""')}"`,
                    `"${(row.sales_rep_name || 'Unassigned').replace(/"/g, '""')}"`
                ];
                csvRows.push(values.join(','));
            }
            
            const csvContent = csvRows.join('\n');
            const filename = `report_${range}_${new Date().toISOString().split('T')[0]}.csv`;
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
            res.status(200).send(csvContent);
        } catch (error) {
            console.error('Error exporting report:', error);
            res.status(500).json({
                success: false,
                message: 'Error exporting report',
                error: error.message
            });
        }
    }
}

module.exports = new ReportsController();