const pool = require('../../config/database');
const OpportunityModel = require('../../models/sales/opportunityModel');

class OpportunityController {
    async createOpportunity(req, res) {
        try {
            const { lead_id, company_name, contact_person, phone, email, value, 
                    stage, priority, source, expected_close_date, assigned_to, notes } = req.body;
            
            if (!company_name) {
                return res.status(400).json({
                    success: false,
                    message: 'Company name is required'
                });
            }
            
            const opportunityModel = new OpportunityModel();
            
            // Generate opportunity ID
            const oppId = await opportunityModel.generateOpportunityId();
            
            const result = await opportunityModel.createOpportunity(
                {
                    oppId,
                    lead_id,
                    company_name,
                    contact_person,
                    phone,
                    email,
                    value,
                    stage,
                    priority,
                    source,
                    expected_close_date,
                    assigned_to,
                    notes
                },
                req.user.id
            );
            
            res.status(201).json({
                success: true,
                message: 'Opportunity created successfully',
                data: { opp_id: result.oppId, id: result.insertId }
            });
        } catch (error) {
            console.error('Error creating opportunity:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating opportunity',
                error: error.message
            });
        }
    }
    
    async getAllOpportunities(req, res) {
        try {
            const { stage, status, search, page = 1, limit = 10 } = req.query;
            
            const opportunityModel = new OpportunityModel();
            
            const opportunities = await opportunityModel.getAllOpportunities(stage, status, search, page, limit);
            const total = await opportunityModel.getOpportunitiesCount(stage, status);
            
            res.status(200).json({
                success: true,
                data: opportunities,
            });
        } catch (error) {
            console.error('Error fetching opportunities:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching opportunities',
                error: error.message
            });
        }
    }
    
    async getOpportunityById(req, res) {
        try {
            const { id } = req.params;
            
            const opportunityModel = new OpportunityModel();
            const opportunity = await opportunityModel.getOpportunityById(id);
            
            if (!opportunity) {
                return res.status(404).json({
                    success: false,
                    message: 'Opportunity not found'
                });
            }
            
            if (opportunity.expected_close_date) {
                opportunity.expected_close_date = opportunity.expected_close_date.toISOString().split('T')[0];
            }
            if (opportunity.created_at) {
                opportunity.created_at = opportunity.created_at.toISOString().split('T')[0];
            }
            if (opportunity.updated_at) {
                opportunity.updated_at = opportunity.updated_at.toISOString().split('T')[0];
            }
            
            res.status(200).json({
                success: true,
                data: opportunity
            });
        } catch (error) {
            console.error('Error fetching opportunity:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching opportunity',
                error: error.message
            });
        }
    }
    
    async updateOpportunity(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            
            const allowedFields = ['company_name', 'contact_person', 'phone', 'email', 'value',
                                   'stage', 'priority', 'source', 'expected_close_date', 
                                   'assigned_to', 'notes', 'status'];
            
            const updateFields = [];
            const params = [];
            
            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    params.push(updates[field]);
                }
            }
            
            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No fields to update'
                });
            }
            
            const opportunityModel = new OpportunityModel();
            
            
            const exists = await opportunityModel.checkOpportunityExists(id);
            if (!exists) {
                return res.status(404).json({
                    success: false,
                    message: 'Opportunity not found'
                });
            }
            
            await opportunityModel.updateOpportunity(id, updateFields, params);
            
           
            const updatedOpportunity = await opportunityModel.getUpdatedOpportunity(id);
            
            res.status(200).json({
                success: true,
                message: 'Opportunity updated successfully',
                data: updatedOpportunity
            });
        } catch (error) {
            console.error('Error updating opportunity:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating opportunity',
                error: error.message
            });
        }
    }
    
    async deleteOpportunity(req, res) {
        try {
            const { id } = req.params;
            
            const opportunityModel = new OpportunityModel();
            
            const exists = await opportunityModel.checkOpportunityExists(id);
            if (!exists) {
                return res.status(404).json({
                    success: false,
                    message: 'Opportunity not found'
                });
            }
            
            await opportunityModel.deleteOpportunity(id);
            
            res.status(200).json({
                success: true,
                message: 'Opportunity deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting opportunity:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting opportunity',
                error: error.message
            });
        }
    }
}

module.exports = new OpportunityController();