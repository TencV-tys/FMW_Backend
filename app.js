require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const postRoutes = require('./routes/postRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reportRoutes = require('./routes/reportRoutes');
const adminNotificationRoutes = require('./routes/adminNotificationRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const contactRoutes = require('./routes/contactRoutes');
const adminDeletionRoutes = require('./routes/adminDeletionRoutes');

const path = require('path');
const os = require('os');

const app = express();

// Middleware - Allow all origins from same network
app.use(cors({ 
  origin: true, // Add your network IP range
  credentials: true 
}));
app.use(express.json());
app.use(cookieParser());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api', postRoutes);
app.use('/api', adminRoutes);
app.use('/api', adminNotificationRoutes);
app.use('/api', notificationRoutes);
app.use('/api', reportRoutes);
app.use('/api', feedbackRoutes);
app.use('/api', contactRoutes);
app.use('/api', adminDeletionRoutes);


const PORT = process.env.PORT || 8000;

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    const interface = interfaces[interfaceName];
    for (const config of interface) {
      if (config.family === 'IPv4' && !config.internal) {
        return config.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on:`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`🌐 Network: http://${localIP}:${PORT}`);
  console.log(`💻 Access from other devices on your WiFi using: http://${localIP}:${PORT}`);
});