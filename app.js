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
const path = require('path');

const app = express();

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true })); // React dev server
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
app.use('/api',reportRoutes);

const PORT = process.env.PORT || 8000;
app.listen(PORT,() => {
  console.log(`Server running on:`);
  console.log(`Local: http://localhost:${PORT}`);
});