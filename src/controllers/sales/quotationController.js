const pool = require('../../config/database');
const QuotationModel = require('../../models/sales/quotationModel');

class QuotationController {
    async createQuotation(req, res) {
        try {
            const { 
                opportunity_id, lead_id, company_name, contact_person, email, phone,
                billing_address, shipping_address, gst_number,
                quotation_date, valid_until,
                payment_terms, delivery_terms, currency,
                items, discount = 0, tax = 0, notes, terms_conditions
            } = req.body;
            
            if (!company_name || !items || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Company name and at least one item are required'
                });
            }
            
            // Calculate totals
            const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
            const total = subtotal - discount + tax;
            
            const quotationModel = new QuotationModel();
            
        
            const quoteId = await quotationModel.generateQuoteId();
            
            const result = await quotationModel.createQuotationWithTransaction(
                {
                    quoteId,
                    opportunity_id,
                    lead_id,
                    company_name,
                    contact_person,
                    email,
                    phone,
                    billing_address,
                    shipping_address,
                    gst_number,
                    quotation_date,
                    valid_until,
                    payment_terms,
                    delivery_terms,
                    currency,
                    subtotal,
                    discount,
                    tax,
                    total,
                    notes,
                    terms_conditions
                },
                items,
                req.user.id
            );
            
            res.status(201).json({
                success: true,
                message: 'Quotation created successfully',
                data: { ...result.quotation, products: result.items }
            });
        } catch (error) {
            console.error('Error creating quotation:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating quotation',
                error: error.message
            });
        }
    }
    
    async getAllQuotations(req, res) {
        try {
            const { status, search, page = 1, limit = 10 } = req.query;
            
            const quotationModel = new QuotationModel();
            
            const quotations = await quotationModel.getAllQuotations(status, search, page, limit);
            const total = await quotationModel.getQuotationsCount(status, search);
            
            if (quotations.length > 0) {
                const quoteIds = quotations.map(q => q.id);
                const allItems = await quotationModel.getItemsByQuoteIds(quoteIds);
                
                const itemsByQuote = {};
                allItems.forEach(item => {
                    if (!itemsByQuote[item.quotation_id]) {
                        itemsByQuote[item.quotation_id] = [];
                    }
                    itemsByQuote[item.quotation_id].push(item);
                });
                
                
                quotations.forEach(quote => {
                    quote.products = itemsByQuote[quote.id] || [];
                });
            }
            
            res.status(200).json({
                success: true,
                data: quotations,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('Error fetching quotations:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching quotations',
                error: error.message
            });
        }
    }
    
    async getQuotationById(req, res) {
        try {
            const { id } = req.params;
            
            const quotationModel = new QuotationModel();
            const quotation = await quotationModel.getQuotationById(id);
            
            if (!quotation) {
                return res.status(404).json({
                    success: false,
                    message: 'Quotation not found'
                });
            }
            
            const items = await quotationModel.getQuotationItems(id);
            
            if (quotation.quotation_date) {
                quotation.quotation_date = quotation.quotation_date.toISOString().split('T')[0];
            }
            if (quotation.valid_until) {
                quotation.valid_until = quotation.valid_until.toISOString().split('T')[0];
            }
            if (quotation.created_at) {
                quotation.created_at = quotation.created_at.toISOString().split('T')[0];
            }
            
            res.status(200).json({
                success: true,
                data: { ...quotation, products: items }
            });
        } catch (error) {
            console.error('Error fetching quotation:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching quotation',
                error: error.message
            });
        }
    }
    
    async updateQuotation(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            
            const allowedFields = [
                'valid_until', 'discount', 'tax', 'notes', 'status',
                'billing_address', 'shipping_address', 'gst_number',
                'payment_terms', 'delivery_terms', 'currency',
                'contact_person', 'email', 'phone', 'company_name',
                'quotation_date', 'terms_conditions'
            ];
            
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
            
            const quotationModel = new QuotationModel();
            
            const exists = await quotationModel.checkQuotationExists(id);
            if (!exists) {
                return res.status(404).json({
                    success: false,
                    message: 'Quotation not found'
                });
            }
            
            await quotationModel.updateQuotation(id, updateFields, params);
            
            const updatedQuotation = await quotationModel.getUpdatedQuotation(id);
            const updatedItems = await quotationModel.getQuotationItems(id);
            
            res.status(200).json({
                success: true,
                message: 'Quotation updated successfully',
                data: { ...updatedQuotation, products: updatedItems }
            });
        } catch (error) {
            console.error('Error updating quotation:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating quotation',
                error: error.message
            });
        }
    }
    
    async deleteQuotation(req, res) {
        try {
            const { id } = req.params;
            
            const quotationModel = new QuotationModel();
            
            const exists = await quotationModel.checkQuotationExists(id);
            if (!exists) {
                return res.status(404).json({
                    success: false,
                    message: 'Quotation not found'
                });
            }
            
            await quotationModel.deleteQuotationWithTransaction(id);
            
            res.status(200).json({
                success: true,
                message: 'Quotation deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting quotation:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting quotation',
                error: error.message
            });
        }
    }
    
    async updateQuotationStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            
            const validStatuses = ['Draft', 'Sent', 'Accepted', 'Rejected'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status value'
                });
            }
            
            const quotationModel = new QuotationModel();
            
            const exists = await quotationModel.checkQuotationExists(id);
            if (!exists) {
                return res.status(404).json({
                    success: false,
                    message: 'Quotation not found'
                });
            }
            
            await quotationModel.updateQuotationStatus(id, status);
            
            res.status(200).json({
                success: true,
                message: `Quotation status updated to ${status}`,
                data: { id: parseInt(id), status }
            });
        } catch (error) {
            console.error('Error updating quotation status:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating quotation status',
                error: error.message
            });
        }
    }
}

module.exports = new QuotationController();