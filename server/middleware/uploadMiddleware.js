const multer = require('multer');
const path = require('path');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext === '.txt' || ext === '.pdf') {
      cb(null, true);
    } else {
      const err = new Error('Only .txt and .pdf files are supported.');
      err.statusCode = 400;
      cb(err);
    }
  },
});

module.exports = upload;
