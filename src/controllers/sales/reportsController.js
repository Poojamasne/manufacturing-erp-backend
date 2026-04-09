const pool = require('../../config/database');

class ReportsController {

  // =========================
  // GET REPORT DATA
  // =========================
  async getReportData(req, res) {
    try {
      let { range = 'yearly', startDate, endDate } = req.query;
      const normalizedRange = range.toLowerCase();

      console.log("Range:", normalizedRange);
      console.log("Start:", startDate);
      console.log("End:", endDate);

      let dateCondition = '';
      let dateParams = [];

      // ✅ FILTER HANDLING
      switch (normalizedRange) {
        case 'weekly':
          dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
          break;

        case 'monthly':
          dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
          break;

        case 'quarterly':
          dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
          break;

        case 'yearly':
          dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
          break;

        case 'custom':
          if (!startDate || !endDate) {
            return res.status(400).json({
              success: false,
              message: "Start date and end date required"
            });
          }
          dateCondition = `AND DATE(created_at) BETWEEN ? AND ?`;
          dateParams = [startDate, endDate];
          break;

        default:
          return res.status(400).json({
            success: false,
            message: "Invalid range"
          });
      }

      // =========================
      // 1. Revenue
      // =========================
      const [revenueData] = await pool.query(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m-%d') as name,
          SUM(total_amount) as val
        FROM orders
        WHERE status='Delivered' ${dateCondition}
        GROUP BY DATE(created_at)
        ORDER BY created_at ASC
        LIMIT 30
      `, dateParams);

      // =========================
      // 2. Lead Sources
      // =========================
      let sourceQuery = `
        SELECT 
          COALESCE(lead_source,'Other') as name,
          COUNT(*) as value
        FROM leads
        WHERE 1=1
      `;

      if (dateCondition) {
        sourceQuery += ` ${dateCondition.replace(/created_at/g, 'leads.created_at')}`;
      }

      sourceQuery += ` GROUP BY lead_source`;

      const [sourceData] = await pool.query(sourceQuery, dateParams);

      // =========================
      // 3. KPI
      // =========================
      let leadsQuery = `SELECT COUNT(*) as total_leads FROM leads WHERE 1=1`;

      if (dateCondition) {
        leadsQuery += ` ${dateCondition.replace(/created_at/g, 'leads.created_at')}`;
      }

      const [leadsRes] = await pool.query(leadsQuery, dateParams);

      let ordersQuery = `
        SELECT 
          SUM(total_amount) as total_revenue,
          COUNT(*) as total_orders,
          AVG(total_amount) as avg_order_value
        FROM orders
        WHERE status='Delivered'
      `;

      if (dateCondition) {
        ordersQuery += ` ${dateCondition}`;
      }

      const [ordersRes] = await pool.query(ordersQuery, dateParams);

      const totalLeads = leadsRes[0]?.total_leads || 0;
      const totalOrders = ordersRes[0]?.total_orders || 0;
      const totalRevenue = ordersRes[0]?.total_revenue || 0;
      const avgOrderValue = ordersRes[0]?.avg_order_value || 0;

      const conversion = totalLeads ? (totalOrders / totalLeads) * 100 : 0;

      // =========================
      // 4. Products
      // =========================
      let productQuery = `
        SELECT 
          oi.product_name as name,
          SUM(oi.quantity) as sold
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status='Delivered'
      `;

      if (dateCondition) {
        productQuery += ` ${dateCondition.replace(/created_at/g, 'o.created_at')}`;
      }

      productQuery += ` GROUP BY oi.product_name LIMIT 5`;

      const [productData] = await pool.query(productQuery, dateParams);

      const products = productData.map(p => ({
        name: p.name,
        sold: p.sold,
        target: Math.round(p.sold * 1.2),
        prod: Math.round(p.sold * 1.1)
      }));

      // =========================
      // 5. Leaderboard
      // =========================
      let leaderboardQuery = `
        SELECT 
          COALESCE(u.name,'Unassigned') as name,
          COUNT(DISTINCT l.id) as leads,
          COUNT(DISTINCT o.id) as orders,
          SUM(o.total_amount) as revenue
        FROM leads l
        LEFT JOIN orders o 
          ON l.company_name = o.customer_name 
          AND o.status='Delivered'
        LEFT JOIN users u ON l.assigned_to = u.id
        WHERE 1=1
      `;

      if (dateCondition) {
        leaderboardQuery += ` ${dateCondition.replace(/created_at/g, 'o.created_at')}`;
      }

      leaderboardQuery += ` GROUP BY u.name ORDER BY revenue DESC LIMIT 10`;

      const [leaderboardData] = await pool.query(leaderboardQuery, dateParams);

      const leaderboard = leaderboardData.map(l => ({
        name: l.name,
        leads: l.leads,
        conversion: l.leads 
          ? `${((l.orders / l.leads) * 100).toFixed(1)}%`
          : "0%",
        revenue: `₹${l.revenue || 0}`
      }));

      // =========================
      // FINAL RESPONSE
      // =========================
      res.json({
        success: true,
        data: {
          revenue: revenueData,
          sources: sourceData,
          kpis: {
            rev: `₹${totalRevenue}`,
            leads: `${totalLeads}`,
            conv: `${conversion.toFixed(1)}%`,
            avg: `₹${Math.round(avgOrderValue)}`
          },
          products,
          leaderboard
        }
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  // =========================
  // EXPORT CSV
  // =========================
  async exportReport(req, res) {
    try {
      let { range = 'yearly', startDate, endDate } = req.query;
      const normalizedRange = range.toLowerCase();

      let dateCondition = '';
      let dateParams = [];

      switch (normalizedRange) {
        case 'weekly':
          dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
          break;

        case 'monthly':
          dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
          break;

        case 'quarterly':
          dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`;
          break;

        case 'yearly':
          dateCondition = `AND created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
          break;

        case 'custom':
          if (!startDate || !endDate) {
            return res.status(400).json({
              success: false,
              message: "Start date and end date required"
            });
          }
          dateCondition = `AND DATE(created_at) BETWEEN ? AND ?`;
          dateParams = [startDate, endDate];
          break;

        default:
          return res.status(400).json({
            success: false,
            message: "Invalid range"
          });
      }

      const [ordersData] = await pool.query(`
        SELECT 
          order_id,
          customer_name,
          email,
          phone,
          status,
          total_amount,
          DATE_FORMAT(created_at, '%Y-%m-%d') as created_date,
          (SELECT name FROM users WHERE id = sales_rep_id) as sales_rep_name
        FROM orders
        WHERE status = 'Delivered' ${dateCondition}
        ORDER BY created_at DESC
      `, dateParams);

      if (ordersData.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No data found'
        });
      }

      const headers = ['Order ID','Customer Name','Email','Phone','Status','Amount','Date','Sales Rep'];
      const rows = [headers.join(',')];

      ordersData.forEach(row => {
        rows.push([
          row.order_id,
          row.customer_name,
          row.email,
          row.phone,
          row.status,
          row.total_amount,
          row.created_date,
          row.sales_rep_name || 'Unassigned'
        ].join(','));
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=report_${normalizedRange}.csv`);
      res.send(rows.join('\n'));

    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Export error" });
    }
  }
}

module.exports = new ReportsController();