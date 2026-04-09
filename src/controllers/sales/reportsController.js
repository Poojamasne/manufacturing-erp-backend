const pool = require('../../config/database');

class ReportsController {
    async getReportData(req, res) {
        try {
            const { range = 'Monthly', startDate, endDate } = req.query;
            
            console.log('Range received:', range);
            
            // Build date conditions for different tables
            let orderDateCondition = '';
            let leadDateCondition = '';
            let dateParams = [];
            
            if (range === 'Weekly') {
                orderDateCondition = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
                leadDateCondition = `AND l.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
            } else if (range === 'Monthly') {
                orderDateCondition = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
                leadDateCondition = `AND l.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
            } else if (range === 'Quarterly') {
                orderDateCondition = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
                leadDateCondition = `AND l.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
            } else if (range === 'Yearly') {
                orderDateCondition = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
                leadDateCondition = `AND l.created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
            } else if (range === 'Custom' && startDate && endDate) {
                orderDateCondition = `AND DATE(o.created_at) BETWEEN ? AND ?`;
                leadDateCondition = `AND DATE(l.created_at) BETWEEN ? AND ?`;
                dateParams = [startDate, endDate];
            }
            
            // 1. Get Revenue Trend Data
            let revenueQuery = '';
            
            if (range === 'Weekly') {
                revenueQuery = `
                    SELECT 
                        DATE_FORMAT(o.created_at, '%a') as name,
                        CAST(COALESCE(SUM(o.total_amount), 0) AS DECIMAL(10,2)) as val
                    FROM orders o
                    WHERE o.status = 'Delivered' ${orderDateCondition}
                    GROUP BY DAYOFWEEK(o.created_at)
                    ORDER BY DAYOFWEEK(o.created_at) ASC
                `;
            } else if (range === 'Monthly') {
                revenueQuery = `
                    SELECT 
                        CONCAT('W', WEEK(o.created_at, 1) - WEEK(DATE_SUB(o.created_at, INTERVAL DAYOFMONTH(o.created_at)-1 DAY), 1) + 1) as name,
                        CAST(COALESCE(SUM(o.total_amount), 0) AS DECIMAL(10,2)) as val
                    FROM orders o
                    WHERE o.status = 'Delivered' ${orderDateCondition}
                    GROUP BY WEEK(o.created_at)
                    ORDER BY MIN(o.created_at) ASC
                `;
            } else if (range === 'Quarterly') {
                revenueQuery = `
                    SELECT 
                        DATE_FORMAT(o.created_at, '%b') as name,
                        CAST(COALESCE(SUM(o.total_amount), 0) AS DECIMAL(10,2)) as val
                    FROM orders o
                    WHERE o.status = 'Delivered' ${orderDateCondition}
                    GROUP BY MONTH(o.created_at)
                    ORDER BY MONTH(o.created_at) ASC
                `;
            } else if (range === 'Yearly') {
                revenueQuery = `
                    SELECT 
                        DATE_FORMAT(o.created_at, '%Y') as name,
                        CAST(COALESCE(SUM(o.total_amount), 0) AS DECIMAL(10,2)) as val
                    FROM orders o
                    WHERE o.status = 'Delivered' ${orderDateCondition}
                    GROUP BY YEAR(o.created_at)
                    ORDER BY YEAR(o.created_at) ASC
                `;
            } else {
                revenueQuery = `
                    SELECT 
                        DATE_FORMAT(o.created_at, '%Y-%m-%d') as name,
                        CAST(COALESCE(SUM(o.total_amount), 0) AS DECIMAL(10,2)) as val
                    FROM orders o
                    WHERE o.status = 'Delivered' ${orderDateCondition}
                    GROUP BY DATE(o.created_at)
                    ORDER BY o.created_at ASC
                    LIMIT 30
                `;
            }
            
            const [revenueData] = await pool.query(revenueQuery, dateParams);
            console.log('Revenue Data count:', revenueData.length);
            
            // 2. Get Lead Sources Distribution (WITH date filter) - using created_at
            let sourceQuery = `
                SELECT 
                    COALESCE(l.lead_source, 'Other') as name,
                    COUNT(*) as value
                FROM leads l
                WHERE 1=1
            `;
            
            // Only add date condition if not empty
            if (leadDateCondition) {
                sourceQuery += ` ${leadDateCondition}`;
            }
            
            sourceQuery += ` GROUP BY l.lead_source ORDER BY value DESC`;
            
            const [sourceData] = await pool.query(sourceQuery, dateParams);
            console.log('Source Data:', sourceData);
            
            // 3. Get KPI Statistics (WITH date filters)
            // Get total leads count with date filter
            let leadsQuery = `SELECT COUNT(DISTINCT id) as total_leads FROM leads WHERE 1=1`;
            if (leadDateCondition) {
                leadsQuery += ` ${leadDateCondition}`;
            }
            const [totalLeadsResult] = await pool.query(leadsQuery, dateParams);
            
            // Get orders data with date filter
            let ordersQuery = `
                SELECT 
                    CAST(COALESCE(SUM(total_amount), 0) AS DECIMAL(10,2)) as total_revenue,
                    COUNT(*) as total_orders,
                    AVG(total_amount) as avg_order_value
                FROM orders
                WHERE status = 'Delivered'
            `;
            if (orderDateCondition) {
                ordersQuery += ` ${orderDateCondition}`;
            }
            const [ordersResult] = await pool.query(ordersQuery, dateParams);
            
            const totalLeads = parseInt(totalLeadsResult[0]?.total_leads || 0);
            const totalRevenue = parseFloat(ordersResult[0]?.total_revenue || 0);
            const totalOrders = parseInt(ordersResult[0]?.total_orders || 0);
            const avgOrderValue = parseFloat(ordersResult[0]?.avg_order_value || 0);
            const conversionRate = totalLeads > 0 ? (totalOrders / totalLeads) * 100 : 0;
            
            console.log('KPI - Total Leads:', totalLeads, 'Total Orders:', totalOrders, 'Revenue:', totalRevenue);
            
            // Format revenue display
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
            
            // Format avg order value
            let formattedAvgValue = '₹0';
            if (avgOrderValue >= 100000) {
                formattedAvgValue = `₹${(avgOrderValue / 100000).toFixed(1)}L`;
            } else if (avgOrderValue >= 1000) {
                formattedAvgValue = `₹${(avgOrderValue / 1000).toFixed(1)}K`;
            } else if (avgOrderValue > 0) {
                formattedAvgValue = `₹${avgOrderValue.toFixed(0)}`;
            }
            
            // 4. Get Product Performance (WITH date filter)
            let productQuery = `
                SELECT 
                    oi.product_name as name,
                    CAST(COALESCE(SUM(oi.quantity), 0) AS UNSIGNED) as sold,
                    CAST(COALESCE(SUM(oi.total_price), 0) AS DECIMAL(10,2)) as revenue
                FROM order_items oi
                INNER JOIN orders o ON oi.order_id = o.id
                WHERE o.status = 'Delivered'
            `;
            if (orderDateCondition) {
                productQuery += ` ${orderDateCondition}`;
            }
            productQuery += ` GROUP BY oi.product_name ORDER BY sold DESC LIMIT 5`;
            
            const [productData] = await pool.query(productQuery, dateParams);
            
            const productsWithTargets = productData.map(product => ({
                name: product.name.length > 15 ? product.name.substring(0, 12) + '...' : product.name,
                sold: parseInt(product.sold) || 0,
                target: Math.round((parseInt(product.sold) || 0) * 1.2),
                prod: Math.round((parseInt(product.sold) || 0) * 1.1)
            }));
            console.log('Products count:', productsWithTargets.length);
            
            // 5. Get Sales Leaderboard (WITH date filters)
            let leaderboardQuery = `
                SELECT 
                    COALESCE(u.name, 'Unassigned') as name,
                    COUNT(DISTINCT l.id) as leads,
                    COUNT(DISTINCT CASE WHEN o.status = 'Delivered' THEN o.id END) as completed_orders,
                    ROUND(
                        IFNULL(
                            (COUNT(DISTINCT CASE WHEN o.status = 'Delivered' THEN o.id END) / NULLIF(COUNT(DISTINCT l.id), 0)) * 100, 0
                        ), 1
                    ) as conversion,
                    CAST(COALESCE(SUM(o.total_amount), 0) AS DECIMAL(10,2)) as revenue
                FROM leads l
                LEFT JOIN orders o ON l.company_name = o.customer_name AND o.status = 'Delivered'
                LEFT JOIN users u ON l.assigned_to = u.id
                WHERE 1=1
            `;
            
            // Add lead date condition
            if (leadDateCondition) {
                leaderboardQuery += ` ${leadDateCondition}`;
            }
            
            // Add order date condition (for the orders join)
            if (orderDateCondition) {
                leaderboardQuery += ` AND o.created_at ${orderDateCondition.replace('AND o.created_at', '')}`;
            }
            
            leaderboardQuery += ` GROUP BY l.assigned_to, u.name ORDER BY revenue DESC LIMIT 10`;
            
            // For leaderboard, we need to pass date params twice (once for leads, once for orders)
            const leaderboardParams = [...dateParams, ...dateParams];
            const [leaderboardData] = await pool.query(leaderboardQuery, leaderboardParams);
            
            const formattedLeaderboard = leaderboardData.map(rep => ({
                name: rep.name || 'Unassigned',
                leads: parseInt(rep.leads) || 0,
                conversion: `${parseFloat(rep.conversion) || 0}%`,
                revenue: `₹${((parseFloat(rep.revenue) || 0) / 100000).toFixed(1)}L`
            }));
            
            res.status(200).json({
                success: true,
                data: {
                    revenue: revenueData.length > 0 ? revenueData : [{ name: 'No Data', val: 0 }],
                    sources: sourceData.length > 0 ? sourceData : [{ name: 'No Data', value: 100 }],
                    kpis: {
                        rev: formattedRevenue,
                        leads: formattedLeads,
                        conv: `${conversionRate.toFixed(1)}%`,
                        avg: formattedAvgValue
                    },
                    products: productsWithTargets.length > 0 ? productsWithTargets : [{ name: 'No Data', sold: 0, target: 0, prod: 0 }],
                    leaderboard: formattedLeaderboard.length > 0 ? formattedLeaderboard : [{ name: 'No Data', leads: 0, conversion: '0%', revenue: '₹0' }]
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
            
            let orderDateCondition = '';
            let dateParams = [];
            
            if (range === 'Weekly') {
                orderDateCondition = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
            } else if (range === 'Monthly') {
                orderDateCondition = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
            } else if (range === 'Quarterly') {
                orderDateCondition = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
            } else if (range === 'Yearly') {
                orderDateCondition = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
            } else if (range === 'Custom' && startDate && endDate) {
                orderDateCondition = `AND DATE(o.created_at) BETWEEN ? AND ?`;
                dateParams = [startDate, endDate];
            }
            
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
                WHERE o.status = 'Delivered' ${orderDateCondition}
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