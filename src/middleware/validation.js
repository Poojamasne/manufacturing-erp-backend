const validateLeadCreation = (req, res, next) => {
    const { company_name, phone } = req.body;
    
    if (!company_name) {
        return res.status(400).json({
            success: false,
            message: 'Company name is required'
        });
    }
    
    if (!phone) {
        return res.status(400).json({
            success: false,
            message: 'Phone number is required'
        });
    }
    
    next();
};

module.exports = { validateLeadCreation };