const pool = require('../../config/database');

class ReportsController {
    async getReportData(req, res) {
        try {
            const { range = 'Monthly', startDate, endDate } = req.query;
            
            // Build date condition
            let dateCondition = '';
            let dateParams = [];
            
            if (range === 'Weekly') {
                dateCondition = `AND l.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
            } else if (range === 'Monthly') {
                dateCondition = `AND l.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
            } else if (range === 'Quarterly') {
                dateCondition = `AND l.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
            } else if (range === 'Yearly') {
                dateCondition = `AND l.created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
            } else if (range === 'Custom' && startDate && endDate) {
                dateCondition = `AND DATE(l.created_at) BETWEEN ? AND ?`;
                dateParams = [startDate, endDate];
            }
            
            // 1. Get Revenue Trend Data
            let revenueQuery = '';
            
            if (range === 'Weekly') {
                revenueQuery = `
                    SELECT 
                        DATE_FORMAT(l.created_at, '%a') as name,
                        COALESCE(SUM(o.value), 0) as val
                    FROM leads l
                    LEFT JOIN opportunities o ON l.id = o.lead_id AND o.status = 'Won'
                    WHERE 1=1 ${dateCondition}
                    GROUP BY DAYOFWEEK(l.created_at)
                    ORDER BY DAYOFWEEK(l.created_at) ASC
                `;
            } else if (range === 'Monthly') {
                revenueQuery = `
                    SELECT 
                        CONCAT('W', WEEK(l.created_at, 1) - WEEK(DATE_SUB(l.created_at, INTERVAL DAYOFMONTH(l.created_at)-1 DAY), 1) + 1) as name,
                        COALESCE(SUM(o.value), 0) as val
                    FROM leads l
                    LEFT JOIN opportunities o ON l.id = o.lead_id AND o.status = 'Won'
                    WHERE 1=1 ${dateCondition}
                    GROUP BY WEEK(l.created_at)
                    ORDER BY MIN(l.created_at) ASC
                `;
            } else if (range === 'Quarterly') {
                revenueQuery = `
                    SELECT 
                        DATE_FORMAT(l.created_at, '%b') as name,
                        COALESCE(SUM(o.value), 0) as val
                    FROM leads l
                    LEFT JOIN opportunities o ON l.id = o.lead_id AND o.status = 'Won'
                    WHERE 1=1 ${dateCondition}
                    GROUP BY MONTH(l.created_at)
                    ORDER BY MONTH(l.created_at) ASC
                `;
            } else if (range === 'Yearly') {
                revenueQuery = `
                    SELECT 
                        DATE_FORMAT(l.created_at, '%Y') as name,
                        COALESCE(SUM(o.value), 0) as val
                    FROM leads l
                    LEFT JOIN opportunities o ON l.id = o.lead_id AND o.status = 'Won'
                    WHERE 1=1 ${dateCondition}
                    GROUP BY YEAR(l.created_at)
                    ORDER BY YEAR(l.created_at) ASC
                `;
            } else {
                // Default daily for custom range
                revenueQuery = `
                    SELECT 
                        DATE_FORMAT(l.created_at, '%Y-%m-%d') as name,
                        COALESCE(SUM(o.value), 0) as val
                    FROM leads l
                    LEFT JOIN opportunities o ON l.id = o.lead_id AND o.status = 'Won'
                    WHERE 1=1 ${dateCondition}
                    GROUP BY DATE(l.created_at)
                    ORDER BY l.created_at ASC
                    LIMIT 30
                `;
            }
            
            const [revenueData] = await pool.query(revenueQuery, dateParams);
            
            // 2. Get Lead Sources Distribution
            const [sourceData] = await pool.query(`
                SELECT 
                    COALESCE(l.lead_source, 'Other') as name,
                    COUNT(*) as value
                FROM leads l
                WHERE 1=1 ${dateCondition}
                GROUP BY l.lead_source
                ORDER BY value DESC
            `, dateParams);
            
            // 3. Get KPI Statistics
            const [kpiData] = await pool.query(`
                SELECT 
                    COALESCE(SUM(o.value), 0) as total_revenue,
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
                WHERE 1=1 ${dateCondition}
            `, dateParams);
            
            // Format KPIs for frontend display
            const totalRevenue = parseFloat(kpiData[0]?.total_revenue || 0);
            const totalLeads = parseInt(kpiData[0]?.total_leads || 0);
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
            
            // Format leads (K for thousands)
            let formattedLeads = totalLeads.toString();
            if (totalLeads >= 1000) {
                formattedLeads = `${(totalLeads / 1000).toFixed(1)}K`;
            } else if (totalLeads === 0) {
                formattedLeads = '0';
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
            
            // 4. Get Product Performance (Manufacturing vs Sales)
            const [productData] = await pool.query(`
                SELECT 
                    lp.product_name as name,
                    COALESCE(SUM(lp.quantity), 0) as sold,
                    COALESCE(SUM(lp.total_price), 0) as revenue,
                    COUNT(DISTINCT lp.lead_id) as orders
                FROM lead_products lp
                INNER JOIN leads l ON lp.lead_id = l.id
                WHERE 1=1 ${dateCondition}
                GROUP BY lp.product_name
                ORDER BY sold DESC
                LIMIT 5
            `, dateParams);
            
            // Add target (20% higher than sold) and production (10% higher than sold) for chart
            const productsWithTargets = productData.map(product => ({
                name: product.name.length > 15 ? product.name.substring(0, 12) + '...' : product.name,
                sold: product.sold,
                target: Math.round(product.sold * 1.2),
                prod: Math.round(product.sold * 1.1)
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
                    COALESCE(SUM(o.value), 0) as revenue
                FROM leads l
                LEFT JOIN opportunities o ON l.id = o.lead_id
                LEFT JOIN users u ON l.assigned_to = u.id
                WHERE 1=1 ${dateCondition}
                GROUP BY l.assigned_to, u.name
                ORDER BY revenue DESC
                LIMIT 10
            `, dateParams);
            
            // Format leaderboard data
            const formattedLeaderboard = leaderboardData.map(rep => ({
                name: rep.name || 'Unassigned',
                leads: rep.leads || 0,
                conversion: `${rep.conversion || 0}%`,
                revenue: `₹${((rep.revenue || 0) / 100000).toFixed(1)}L`
            }));
            
            // If no data, provide default structure
            const finalRevenueData = revenueData.length > 0 ? revenueData : [{ name: 'No Data', val: 0 }];
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
            
            // Get leads data for export
            const [leadsData] = await pool.query(`
                SELECT 
                    lead_id, 
                    company_name, 
                    contact_person, 
                    status, 
                    priority, 
                    DATE_FORMAT(created_at, '%Y-%m-%d') as created_date
                FROM leads
                WHERE 1=1 ${dateCondition}
                ORDER BY created_at DESC
            `, dateParams);
            
            if (leadsData.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No data found for export'
                });
            }
            
            // Convert to CSV
            const headers = ['Lead ID', 'Company Name', 'Contact Person', 'Status', 'Priority', 'Created Date'];
            const csvRows = [headers.join(',')];
            
            for (const row of leadsData) {
                const values = [
                    `"${(row.lead_id || '').replace(/"/g, '""')}"`,
                    `"${(row.company_name || '').replace(/"/g, '""')}"`,
                    `"${(row.contact_person || '').replace(/"/g, '""')}"`,
                    `"${(row.status || '').replace(/"/g, '""')}"`,
                    `"${(row.priority || '').replace(/"/g, '""')}"`,
                    `"${(row.created_date || '').replace(/"/g, '""')}"`
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