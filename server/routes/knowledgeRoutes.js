const express = require('express');
const knowledgeController = require('../controllers/knowledgeController');
const { requireAuth } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(requireAuth);
router.get('/', knowledgeController.listDocuments);
router.post('/upload', upload.single('file'), knowledgeController.uploadDocument);
router.post('/text', knowledgeController.addTextDocument);
router.post('/query', knowledgeController.queryKnowledge);
router.delete('/:id', knowledgeController.deleteDocument);

module.exports = router;
