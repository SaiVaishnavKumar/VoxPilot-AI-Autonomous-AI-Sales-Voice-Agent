const express = require('express');
const aiController = require('../controllers/aiController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/status', aiController.status);

router.use(requireAuth);
router.post('/chat', aiController.chat);
router.post('/analyze', aiController.analyze);
router.post('/summarize', aiController.summarize);
router.post('/qualify', aiController.qualify);

module.exports = router;
