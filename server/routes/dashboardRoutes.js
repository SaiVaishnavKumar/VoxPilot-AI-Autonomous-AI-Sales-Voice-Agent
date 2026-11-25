const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.get('/stats', dashboardController.getStats);
router.get('/analytics', dashboardController.getAnalytics);

module.exports = router;
