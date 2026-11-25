const db = require('../config/database');
const ragService = require('../services/rag/ragService');

async function listDocuments(req, res, next) {
  try {
    const documents = await db.knowledge.findAll();
    res.json({ success: true, count: documents.length, documents });
  } catch (err) {
    next(err);
  }
}

async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please attach a .txt or .pdf file.' });
    }
    const { text, sourceType } = await ragService.extractTextFromFile(req.file);
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract readable text from the uploaded file.',
      });
    }

    const title = req.body?.title?.trim() || req.file.originalname.replace(/\.[^/.]+$/, '');
    const category = req.body?.category?.trim() || 'Uploaded Document';

    const doc = await ragService.ingestDocument({
      title,
      category,
      industry: req.body?.industry || 'real-estate',
      sourceType,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      content: text,
    });

    res.status(201).json({ success: true, document: doc });
  } catch (err) {
    next(err);
  }
}

async function addTextDocument(req, res, next) {
  try {
    const { title, category = 'Business Policy', industry = 'real-estate', content } =
      req.body || {};
    if (!title || !content || !String(content).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Document title and content are required.',
      });
    }

    const doc = await ragService.ingestDocument({
      title,
      category,
      industry,
      sourceType: 'text',
      content: String(content).trim(),
    });

    res.status(201).json({ success: true, document: doc });
  } catch (err) {
    next(err);
  }
}

async function queryKnowledge(req, res, next) {
  try {
    const { query, topK = 4 } = req.body || {};
    if (!query || !String(query).trim()) {
      return res.status(400).json({ success: false, message: 'Search query is required.' });
    }
    const result = await ragService.retrieveRelevantChunks(query, { topK: Number(topK) || 4 });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function deleteDocument(req, res, next) {
  try {
    const deleted = await db.knowledge.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Knowledge document not found.' });
    }
    res.json({ success: true, message: 'Knowledge document deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listDocuments,
  uploadDocument,
  addTextDocument,
  queryKnowledge,
  deleteDocument,
};
