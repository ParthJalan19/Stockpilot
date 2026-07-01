const express = require('express');
const router = Router = express.Router();
const { getReportData } = require('../controllers/reportController');
const { protect, hasPermission } = require('../middleware/auth');

router.get('/', protect, hasPermission('can_export'), getReportData);

module.exports = router;
