// config/multer.js
const multer = require('multer');
const path = require('path');

// Configure storage for different types of uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine destination based on route
    if (req.originalUrl.includes('resolution-request')) {
      cb(null, 'uploads/resolution-proofs/');
    } else {
      cb(null, 'uploads/');
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    
    if (req.originalUrl.includes('resolution-request')) {
      cb(null, 'resolution-' + uniqueSuffix + path.extname(file.originalname));
    } else {
      cb(null, 'post-' + uniqueSuffix + path.extname(file.originalname));
    }
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

module.exports = upload;