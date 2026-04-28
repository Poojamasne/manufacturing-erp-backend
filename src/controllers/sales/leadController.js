const pool = require("../../config/database");
const LeadModel = require("../../models/sales/leadModel");

class LeadController {
    async createLead(req, res) {
        try {
            const {
                company_name,
                contact_person,
                phone,
                email,
                address,
                city,
                state,
                gst_number,
                lead_source,
                priority,
                expected_close_date,
                followup_date,
                notes,
                assigned_to,
                products,
            } = req.body;

            if (!company_name || !phone) {
                return res.status(400).json({
                    success: false,
                    message: "Company name and phone are required",
                });
            }

            const leadModel = new LeadModel();
            
            const result = await leadModel.createLeadWithTransaction(
                {
                    company_name,
                    contact_person,
                    phone,
                    email,
                    address,
                    city,
                    state,
                    gst_number,
                    lead_source,
                    priority,
                    expected_close_date,
                    followup_date,
                    notes,
                    assigned_to,
                },
                products,
                req.user.id
            );

            res.status(201).json({
                success: true,
                message: "Lead created successfully",
                data: { 
                    lead_id: result.leadId, 
                    id: result.insertId 
                },
            });
        } catch (error) {
            console.error("Error creating lead:", error);
            res.status(500).json({
                success: false,
                message: "Error creating lead",
                error: error.message,
            });
        }
    }

    async getAllLeads(req, res) {
        try {
            const { status, priority, search, page = 1, limit = 100 } = req.query;

            const leadModel = new LeadModel();
            
            const leads = await leadModel.getAllLeads(status, priority, search, page, limit);
            const total = await leadModel.getLeadsCount(status, priority, search);

            
            if (leads.length > 0) {
                const leadIds = leads.map((lead) => lead.id);
                const allProducts = await leadModel.getProductsByLeadIds(leadIds);

               
                const productsByLead = {};
                allProducts.forEach((product) => {
                    if (!productsByLead[product.lead_id]) {
                        productsByLead[product.lead_id] = [];
                    }
                    
                    productsByLead[product.lead_id].push({
                        id: product.id,
                        product_id: product.product_id,
                        product_name: product.product_name || product.product_name_from_db,
                        variant: product.variant,
                        quantity: product.quantity,
                        unit_price: product.unit_price,
                        total_price: product.total_price,
                        category: product.category,
                        original_price: product.original_price,
                    });
                });

              
                leads.forEach((lead) => {
                    lead.products = productsByLead[lead.id] || [];
                });
            }

            res.status(200).json({
                success: true,
                data: leads,
            });
        } catch (error) {
            console.error("Error fetching leads:", error);
            res.status(500).json({
                success: false,
                message: "Error fetching leads",
                error: error.message,
            });
        }
    }

    async getLeadById(req, res) {
        try {
            const { id } = req.params;

            const leadModel = new LeadModel();
            const lead = await leadModel.getLeadById(id);

            if (!lead) {
                return res.status(404).json({
                    success: false,
                    message: "Lead not found",
                });
            }

            const products = await leadModel.getProductsByLeadId(id);

            res.status(200).json({
                success: true,
                data: { ...lead, products },
            });
        } catch (error) {
            console.error("Error fetching lead:", error);
            res.status(500).json({
                success: false,
                message: "Error fetching lead",
                error: error.message,
            });
        }
    }

    async updateLead(req, res) {
        try {
            const { id } = req.params;
            const {
                company_name,
                contact_person,
                phone,
                email,
                address,
                city,
                state,
                gst_number,
                lead_source,
                priority,
                status,
                expected_close_date,
                followup_date,
                notes,
                assigned_to,
                products,
            } = req.body;

            const leadModel = new LeadModel();

            
            const leadExists = await leadModel.checkLeadExists(id);
            if (!leadExists) {
                return res.status(404).json({
                    success: false,
                    message: "Lead not found",
                });
            }

            
            if (!company_name || !phone) {
                return res.status(400).json({
                    success: false,
                    message: "Company name and phone are required",
                });
            }

            await leadModel.updateLeadWithTransaction(
                id,
                {
                    company_name,
                    contact_person,
                    phone,
                    email,
                    address,
                    city,
                    state,
                    gst_number,
                    lead_source,
                    priority,
                    status,
                    expected_close_date,
                    followup_date,
                    notes,
                    assigned_to,
                },
                products,
                req.user.id
            );

           
            const updatedLead = await leadModel.getLeadById(id);
            const updatedProducts = await leadModel.getProductsByLeadId(id);

            res.status(200).json({
                success: true,
                message: "Lead updated successfully",
                data: { ...updatedLead, products: updatedProducts },
            });
        } catch (error) {
            console.error("Error updating lead:", error);
            
            
            if (error.message.includes("Product with ID")) {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }
            if (error.message.includes("Variant with ID")) {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }
            if (error.message.includes("Product name is required")) {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }
            if (error.message.includes("Valid quantity is required")) {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }
            if (error.message.includes("Valid unit price is required")) {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }
            
            res.status(500).json({
                success: false,
                message: "Error updating lead",
                error: error.message,
            });
        }
    }

    async deleteLead(req, res) {
        try {
            const { id } = req.params;
            
            const leadModel = new LeadModel();
            await leadModel.deleteLead(id);

            res.status(200).json({
                success: true,
                message: "Lead deleted successfully",
            });
        } catch (error) {
            console.error("Error deleting lead:", error);
            res.status(500).json({
                success: false,
                message: "Error deleting lead",
                error: error.message,
            });
        }
    }

    async getAllProducts(req, res) {
        try {
            const { search, page = 1, limit = 50 } = req.query;

            const leadModel = new LeadModel();
            
            const products = await leadModel.getAllProducts(search);
            const total = await leadModel.getProductsCount(search);

           
            if (products.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: [],
                });
            }

            const productIds = products.map((p) => p.product_id);
            const variants = await leadModel.getVariantsByProductIds(productIds);

           
            const variantsByProduct = {};
            variants.forEach((variant) => {
                if (!variantsByProduct[variant.product_id]) {
                    variantsByProduct[variant.product_id] = [];
                }
                variantsByProduct[variant.product_id].push({
                    variant_id: variant.variant_id,
                    variant_name: variant.variant_name,
                    quantity: variant.quantity,
                    unit_price: variant.unit_price,
                    total_price: variant.total_price,
                    lead_id: variant.lead_id,
                    company_name: variant.company_name,
                    status: variant.status,
                });
            });


            const productsWithVariants = products.map((product) => ({
                ...product,
                variants: variantsByProduct[product.product_id] || [],
            }));

            res.status(200).json({
                success: true,
                data: productsWithVariants,
            });
        } catch (error) {
            console.error("Error fetching products:", error);
            res.status(500).json({
                success: false,
                message: "Error fetching products",
                error: error.message,
            });
        }
    }
}

module.exports = new LeadController();