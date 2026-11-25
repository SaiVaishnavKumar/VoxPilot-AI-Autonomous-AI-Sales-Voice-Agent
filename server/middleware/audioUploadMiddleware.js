const multer = require('multer');

const AUDIO_MIME_TYPES = new Set([
  'audio/aac',
  'audio/flac',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-wav',
]);

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    const mimeType = String(file.mimetype || '').split(';')[0].toLowerCase();
    if (AUDIO_MIME_TYPES.has(mimeType)) {
      callback(null, true);
      return;
    }

    const error = new Error('Unsupported audio format. Record a WebM, MP4, WAV, OGG, AAC, or FLAC clip.');
    error.statusCode = 400;
    callback(error);
  },
});
