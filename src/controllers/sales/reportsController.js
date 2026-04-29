const pool = require('../../config/database');
const ReportModel = require('../../models/sales/reportModel');

class ReportsController {
    async getReportData(req, res) {
        try {
            const { range = 'Yearly', startDate, endDate } = req.query;

            console.log('Range received:', range);

            const reportModel = new ReportModel();


            const { revenueData, dateCondition, dateParams } = await reportModel.getRevenueData(range, startDate, endDate);
            console.log('Revenue data count:', revenueData.length);


            let finalRevenueData = revenueData;
            if (revenueData.length === 0) {
                finalRevenueData = [{ name: 'No Data', val: 0 }];
            }

            const sourceData = await reportModel.getLeadSources();


            const kpiStats = await reportModel.getKPIStats(dateCondition, dateParams);


            const totalLeads = await reportModel.getTotalLeads();

            const totalRevenue = parseFloat(kpiStats?.total_revenue || 0);
            const totalOrders = parseInt(kpiStats?.total_orders || 0);
            const avgOrderValue = parseFloat(kpiStats?.avg_order_value || 0);
            const conversionRate = totalLeads > 0 ? (totalOrders / totalLeads) * 100 : 0;

            console.log(`${range} - Revenue: ${totalRevenue}, Orders: ${totalOrders}`);


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


            let formattedLeads = totalLeads.toString();
            if (totalLeads >= 1000) {
                formattedLeads = `${(totalLeads / 1000).toFixed(1)}K`;
            }


            let formattedAvgValue = '₹0';
            if (avgOrderValue >= 100000) {
                formattedAvgValue = `₹${(avgOrderValue / 100000).toFixed(1)}L`;
            } else if (avgOrderValue >= 1000) {
                formattedAvgValue = `₹${(avgOrderValue / 1000).toFixed(1)}K`;
            } else if (avgOrderValue > 0) {
                formattedAvgValue = `₹${avgOrderValue.toFixed(0)}`;
            }


            const productData = await reportModel.getProductPerformance(dateCondition, dateParams);

            const productsWithTargets = productData.map(product => ({
                // name: product.name.length > 15 ? product.name.substring(0, 12) + '...' : product.name,
                name: product.name,
                sold: parseInt(product.sold) || 0,
                target: Math.round((parseInt(product.sold) || 0) * 1.2),
                prod: Math.round((parseInt(product.sold) || 0) * 1.1)
            }));


            const leaderboardData = await reportModel.getSalesLeaderboard(dateCondition, dateParams);

            const formattedLeaderboard = leaderboardData.map(rep => ({
                name: rep.name || 'Unassigned',
                leads: parseInt(rep.leads) || 0,
                conversion: '0%',
                revenue: `₹${((parseFloat(rep.revenue) || 0) / 100000).toFixed(1)}L`
            }));


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

            const reportModel = new ReportModel();
            const ordersData = await reportModel.getExportData(range, startDate, endDate);

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