const express = require('express');
const router = express.Router();

// Health check endpoint
router.get('/healthz', (req, res) => {
    const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        docker: process.env.DOCKER_CONTAINER === 'true'
    };

    res.status(200).json(healthData);
});

module.exports = router;