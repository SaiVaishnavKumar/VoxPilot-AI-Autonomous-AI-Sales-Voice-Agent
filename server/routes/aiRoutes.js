const express = require('express');
const aiController = require('../controllers/aiController');
const { requireAuth } = require('../middleware/authMiddleware');
const audioUpload = require('../middleware/audioUploadMiddleware');

const router = express.Router();

router.get('/status', aiController.status);

router.use(requireAuth);
router.post('/transcribe', audioUpload.single('audio'), aiController.transcribe);
router.post('/chat', aiController.chat);
router.post('/analyze', aiController.analyze);
router.post('/summarize', aiController.summarize);
router.post('/qualify', aiController.qualify);

module.exports = router;
