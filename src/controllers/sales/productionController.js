const pool = require('../../config/database');
const ProductionModel = require('../../models/sales/productionModel');

class ProductionController {
    async getAllJobs(req, res) {
        try {
            const { status, stage, search, page = 1, limit = 10, dateRange, startDate, endDate } = req.query;
            
            console.log('Query params:', { status, stage, search, page, limit, dateRange, startDate, endDate });
            
            const productionModel = new ProductionModel();
            
            const { jobs, parsedPage, parsedLimit } = await productionModel.getAllJobs(
                status, stage, search, page, limit, dateRange, startDate, endDate
            );
            
            const total = await productionModel.getJobsCount(
                status, stage, search, dateRange, startDate, endDate
            );
            
            console.log(`Found ${jobs.length} jobs, Total: ${total}`);
            
            res.status(200).json({
                success: true,
                data: jobs,
                pagination: {
                    page: parsedPage,
                    limit: parsedLimit,
                    total: total,
                    pages: Math.ceil(total / parsedLimit)
                }
            });
        } catch (error) {
            console.error('Error fetching production jobs:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching production jobs',
                error: error.message
            });
        }
    }
    
    async getJobById(req, res) {
        try {
            const { id } = req.params;
            
            console.log('Fetching job ID:', id);
            
            const productionModel = new ProductionModel();
            const job = await productionModel.getJobById(id);
            
            if (!job) {
                return res.status(404).json({
                    success: false,
                    message: 'Production job not found'
                });
            }
            
            res.status(200).json({
                success: true,
                data: job
            });
        } catch (error) {
            console.error('Error fetching production job:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching production job',
                error: error.message
            });
        }
    }
    
    async updateJob(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            
            console.log('UPDATE PRODUCTION JOB');
            console.log('Job ID:', id);
            console.log('Update Data:', JSON.stringify(updates, null, 2));
            
            const allowedFields = ['stage', 'status', 'started_at', 'completed_at', 'assigned_to', 'notes'];
            
            const updateFields = [];
            const params = [];
            
            for (const field of allowedFields) {
                if (updates[field] !== undefined && updates[field] !== null && updates[field] !== '') {
                    updateFields.push(`${field} = ?`);
                    params.push(updates[field]);
                    console.log(`Updating ${field} = ${updates[field]}`);
                }
            }
            
            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No fields to update'
                });
            }
            
            const productionModel = new ProductionModel();
            
            // Check if job exists
            const exists = await productionModel.checkJobExists(id);
            if (!exists) {
                return res.status(404).json({
                    success: false,
                    message: 'Production job not found'
                });
            }
            
            const result = await productionModel.updateJob(id, updateFields, params);
            console.log('Update result:', result);
            
            // Fetch updated job
            const updatedJob = await productionModel.getUpdatedJob(id);
            console.log('Updated job data:', updatedJob);
            
            res.status(200).json({
                success: true,
                message: 'Production job updated successfully',
                data: updatedJob || null
            });
        } catch (error) {
            console.error('Error updating production job:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating production job',
                error: error.message
            });
        }
    }
    
    async deleteJob(req, res) {
        try {
            const { id } = req.params;
            
            console.log('Deleting job ID:', id);
            
            const productionModel = new ProductionModel();
            
            // Check if job exists
            const exists = await productionModel.checkJobExists(id);
            if (!exists) {
                return res.status(404).json({
                    success: false,
                    message: 'Production job not found'
                });
            }
            
            await productionModel.deleteJob(id);
            
            res.status(200).json({
                success: true,
                message: 'Production job deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting production job:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting production job',
                error: error.message
            });
        }
    }
}

module.exports = new ProductionController();