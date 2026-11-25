const express = require('express');
const leadsController = require('../controllers/leadsController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.get('/', leadsController.listLeads);
router.post('/', leadsController.createLead);
router.get('/:id', leadsController.getLead);
router.put('/:id', leadsController.updateLead);
router.delete('/:id', leadsController.deleteLead);

module.exports = router;
