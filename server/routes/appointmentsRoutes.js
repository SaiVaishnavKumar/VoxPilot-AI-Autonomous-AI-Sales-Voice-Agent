const express = require('express');
const appointmentsController = require('../controllers/appointmentsController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.get('/', appointmentsController.listAppointments);
router.get('/availability', appointmentsController.getAvailability);
router.post('/', appointmentsController.createAppointment);
router.put('/:id', appointmentsController.updateAppointment);
router.delete('/:id', appointmentsController.deleteAppointment);

module.exports = router;
