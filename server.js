const app = require('./src/app');
const env = require('./src/config/env');

const PORT = env.PORT || 5000;

app.listen(PORT, () => {
    console.log(` Server running on port ${PORT}`);
    console.log(` Environment: ${env.NODE_ENV || 'development'}`);
    console.log(` API URL: http://localhost:${PORT}/api`);
});