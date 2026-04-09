const pool = require('../../config/database');

class ReportsController {
    async getReportData(req, res) {
        try {
            const { range = 'Yearly', startDate, endDate } = req.query;
            
            console.log('Range received:', range);
            
            // Initialize variables
            let dateCondition = '';
            let dateParams = [];
            let revenueQuery = '';
            let groupByClause = '';
            let orderByClause = '';
            
            // Set date condition based on range
            if (range === 'Weekly') {
                dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
                revenueQuery = `
                    SELECT 
                        DATE_FORMAT(created_at, '%a') as name,
                        CAST(COALESCE(SUM(total_amount), 0) AS DECIMAL(10,2)) as val
                    FROM orders
                    WHERE status = 'Delivered' ${dateCondition}
                    GROUP BY DAYOFWEEK(created_at)
                    ORDER BY DAYOFWEEK(created_at) ASC
                `;
            } 
            else if (range === 'Monthly') {
                dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
                revenueQuery = `
                    SELECT 
                        DATE_FORMAT(created_at, '%Y-%m-%d') as name,
                        CAST(COALESCE(SUM(total_amount), 0) AS DECIMAL(10,2)) as val
                    FROM orders
                    WHERE status = 'Delivered' ${dateCondition}
                    GROUP BY DATE(created_at)
                    ORDER BY created_at ASC
                `;
            } 
            else if (range === 'Quarterly') {
                dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
                revenueQuery = `
                    SELECT 
                        DATE_FORMAT(created_at, '%b') as name,
                        CAST(COALESCE(SUM(total_amount), 0) AS DECIMAL(10,2)) as val
                    FROM orders
                    WHERE status = 'Delivered' ${dateCondition}
                    GROUP BY MONTH(created_at)
                    ORDER BY MONTH(created_at) ASC
                `;
            } 
            else if (range === 'Yearly') {
                dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
                revenueQuery = `
                    SELECT 
                        DATE_FORMAT(created_at, '%Y') as name,
                        CAST(COALESCE(SUM(total_amount), 0) AS DECIMAL(10,2)) as val
                    FROM orders
                    WHERE status = 'Delivered' ${dateCondition}
                    GROUP BY YEAR(created_at)
                    ORDER BY YEAR(created_at) ASC
                `;
            } 
            else if (range === 'Custom' && startDate && endDate) {
                dateCondition = `AND DATE(created_at) BETWEEN ? AND ?`;
                dateParams = [startDate, endDate];
                revenueQuery = `
                    SELECT 
                        DATE_FORMAT(created_at, '%Y-%m-%d') as name,
                        CAST(COALESCE(SUM(total_amount), 0) AS DECIMAL(10,2)) as val
                    FROM orders
                    WHERE status = 'Delivered' ${dateCondition}
                    GROUP BY DATE(created_at)
                    ORDER BY created_at ASC
                    LIMIT 30
                `;
            }
            
            // Check if query is empty
            if (!revenueQuery) {
                console.error('Revenue query is empty for range:', range);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid range parameter',
                    error: `No query defined for range: ${range}`
                });
            }
            
            console.log('Executing revenue query for range:', range);
            console.log('Date Condition:', dateCondition);
            
            // Execute revenue query
            const [revenueData] = await pool.query(revenueQuery, dateParams);
            console.log('Revenue data count:', revenueData.length);
            
            // If no revenue data, provide default
            let finalRevenueData = revenueData;
            if (revenueData.length === 0) {
                finalRevenueData = [{ name: 'No Data', val: 0 }];
            }
            
            // 2. Get Lead Sources Distribution
            const [sourceData] = await pool.query(`
                SELECT 
                    COALESCE(lead_source, 'Other') as name,
                    COUNT(*) as value
                FROM leads
                GROUP BY lead_source
                ORDER BY value DESC
            `);
            
            // 3. Get KPI Statistics WITH DATE FILTER
            let ordersQuery = `
                SELECT 
                    CAST(COALESCE(SUM(total_amount), 0) AS DECIMAL(10,2)) as total_revenue,
                    COUNT(*) as total_orders,
                    COALESCE(AVG(total_amount), 0) as avg_order_value
                FROM orders
                WHERE status = 'Delivered' ${dateCondition}
            `;
            
            const [ordersResult] = await pool.query(ordersQuery, dateParams);
            
            // Total leads (all time)
            const [totalLeadsResult] = await pool.query(`
                SELECT COUNT(DISTINCT id) as total_leads FROM leads
            `);
            
            const totalLeads = parseInt(totalLeadsResult[0]?.total_leads || 0);
            const totalRevenue = parseFloat(ordersResult[0]?.total_revenue || 0);
            const totalOrders = parseInt(ordersResult[0]?.total_orders || 0);
            const avgOrderValue = parseFloat(ordersResult[0]?.avg_order_value || 0);
            const conversionRate = totalLeads > 0 ? (totalOrders / totalLeads) * 100 : 0;
            
            console.log(`${range} - Revenue: ${totalRevenue}, Orders: ${totalOrders}`);
            
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
            
            // 4. Get Product Performance
            let productQuery = `
                SELECT 
                    oi.product_name as name,
                    CAST(COALESCE(SUM(oi.quantity), 0) AS UNSIGNED) as sold
                FROM order_items oi
                INNER JOIN orders o ON oi.order_id = o.id
                WHERE o.status = 'Delivered' ${dateCondition.replace(/created_at/g, 'o.created_at')}
                GROUP BY oi.product_name
                ORDER BY sold DESC
                LIMIT 5
            `;
            
            const [productData] = await pool.query(productQuery, dateParams);
            
            const productsWithTargets = productData.map(product => ({
                name: product.name.length > 15 ? product.name.substring(0, 12) + '...' : product.name,
                sold: parseInt(product.sold) || 0,
                target: Math.round((parseInt(product.sold) || 0) * 1.2),
                prod: Math.round((parseInt(product.sold) || 0) * 1.1)
            }));
            
            // 5. Get Sales Leaderboard
            let leaderboardQuery = `
                SELECT 
                    COALESCE(u.name, 'Unassigned') as name,
                    COUNT(DISTINCT l.id) as leads,
                    CAST(COALESCE(SUM(o.total_amount), 0) AS DECIMAL(10,2)) as revenue
                FROM leads l
                LEFT JOIN orders o ON l.company_name = o.customer_name AND o.status = 'Delivered' ${dateCondition.replace(/created_at/g, 'o.created_at')}
                LEFT JOIN users u ON l.assigned_to = u.id
                GROUP BY l.assigned_to, u.name
                ORDER BY revenue DESC
                LIMIT 10
            `;
            
            const [leaderboardData] = await pool.query(leaderboardQuery, dateParams);
            
            const formattedLeaderboard = leaderboardData.map(rep => ({
                name: rep.name || 'Unassigned',
                leads: parseInt(rep.leads) || 0,
                conversion: '0%',
                revenue: `₹${((parseFloat(rep.revenue) || 0) / 100000).toFixed(1)}L`
            }));
            
            // Send response
            res.status(200).json({
                success: true,
                data: {
                    revenue: finalRevenueData,
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
            const { range = 'Yearly', startDate, endDate } = req.query;
            
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
            } else {
                dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
            }
            
            const [ordersData] = await pool.query(`
                SELECT 
                    order_id,
                    customer_name,
                    total_amount,
                    DATE_FORMAT(created_at, '%Y-%m-%d') as created_date
                FROM orders
                WHERE status = 'Delivered' ${dateCondition}
                ORDER BY created_at DESC
            `, dateParams);
            
            if (ordersData.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No data found for export'
                });
            }
            
            const headers = ['Order ID', 'Customer Name', 'Total Amount', 'Created Date'];
            const csvRows = [headers.join(',')];
            
            for (const row of ordersData) {
                const values = [
                    `"${(row.order_id || '').replace(/"/g, '""')}"`,
                    `"${(row.customer_name || '').replace(/"/g, '""')}"`,
                    `${row.total_amount || 0}`,
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