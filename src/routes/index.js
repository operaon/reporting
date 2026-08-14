const express = require('express');
const reportingRoutes = require('./reportingRoutes');

const router = express.Router();
router.use('/reporting', reportingRoutes);

module.exports = router;
