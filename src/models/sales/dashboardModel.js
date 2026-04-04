const pool = require('../../config/database');

class DashboardModel {
    static async getRecentLeads(limit = 5) {
        try {
            const [leads] = await pool.query(
                `SELECT l.id, l.lead_id, l.company_name, l.contact_person, 
                        l.phone_number, l.email_id, l.status, l.created_at
                 FROM leads l
                 ORDER BY l.created_at DESC
                 LIMIT ?`,
                [limit]
            );
            return leads;
        } catch (error) {
            console.error('Error getting recent leads:', error);
            return [];
        }
    }
}

module.exports = DashboardModel;