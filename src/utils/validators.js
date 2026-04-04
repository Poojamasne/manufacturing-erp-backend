const validateLeadData = (leadData) => {
    if (!leadData.company_name) return 'Company name is required';
    if (!leadData.contact_person) return 'Contact person is required';
    if (!leadData.phone_number) return 'Phone number is required';
    return null;
};

module.exports = { validateLeadData };
