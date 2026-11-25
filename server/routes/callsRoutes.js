const express = require('express');
const callsController = require('../controllers/callsController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.get('/', callsController.listCalls);
router.post('/', callsController.startCall);
router.get('/:id', callsController.getCall);
router.patch('/:id/end', callsController.endCall);
router.delete('/:id', callsController.deleteCall);

module.exports = router;
