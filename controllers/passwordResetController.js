// controllers/passwordResetController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const emailService = require('../services/emailService');
const { findUserByEmail } = require('../models/User');

const passwordResetController = {
  // Request password reset
  requestReset: async (req, res) => {
    try {
      const { email } = req.body;
      const user = await findUserByEmail(email);
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: 'No account found with this email address' 
        }); // ✅ Fixed!
      }

      // Generate reset token
      const resetToken = jwt.sign(
        { 
          id: user.id, 
          email: user.email,
          type: 'password_reset'
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // DELETE old tokens
      await db('password_resets')
        .where('email', user.email)
        .del();

      // INSERT new token
      const resetData = {
        email: user.email,
        token: resetToken,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        used: false,
        created_at: new Date()
      };

      await db('password_resets').insert(resetData);

      console.log('✅ New reset token generated for:', user.email);

      // Send email
      await emailService.sendPasswordResetEmail(user.email, user.first_name, resetToken);

      res.json({ 
        success: true, 
        message: 'Password reset email sent successfully! Check your inbox.' 
      });

    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Server error. Please try again.' 
      });
    }
  },

  // Verify reset token
  verifyResetToken: async (req, res) => {
    try {
      const { token } = req.body;
          

  


      if (!token) {
         console.log('❌ No token provided');
        return res.status(400).json({
          success: false,
          error: 'Reset token is required'
        });
      }

      // Verify JWT token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      } catch (jwtError) {
        console.log('❌ JWT verification failed:', jwtError.message);
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token'
        });
      }
      
      if (decoded.type !== 'password_reset') {
        return res.status(400).json({
          success: false,
          error: 'Invalid reset token'
        });
      }

      // Check if token exists in database and hasn't been used
      const resetRecord = await db('password_resets')
        .where('email', decoded.email)
        .where('token', token)
        .where('expires_at', '>', new Date())
        .where('used', false)
        .first();

      if (!resetRecord) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token'
        });
      }

      res.json({
        success: true,
        message: 'Token is valid',
        email: decoded.email
      });

    } catch (error) {
      console.error('Token verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error verifying token'
      });
    }
  },

  // Reset password
  resetPassword: async (req, res) => {
    try {
      const { token, password, password_confirmation } = req.body;

      if (!token || !password || !password_confirmation) {
        return res.status(400).json({
          success: false,
          error: 'All fields are required'
        });
      }

      if (password !== password_confirmation) {
        return res.status(400).json({
          success: false,
          error: 'Passwords do not match'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 6 characters'
        });
      }

      // Verify JWT token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (jwtError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token'
        });
      }
      
      if (decoded.type !== 'password_reset') {
        return res.status(400).json({
          success: false,
          error: 'Invalid reset token'
        });
      }

      // Check if token exists and is valid
      const resetRecord = await db('password_resets')
        .where('email', decoded.email)
        .where('token', token)
        .where('expires_at', '>', new Date())
        .where('used', false)
        .first();

      if (!resetRecord) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token'
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update user password
      await db('users')
        .where('email', decoded.email)
        .update({
          password: hashedPassword,
          updated_at: new Date()
        });

      // Mark reset token as used
      await db('password_resets')
        .where('token', token)
        .update({
          used: true,
          used_at: new Date()
        });

      res.json({
        success: true,
        message: 'Password reset successfully! You can now login with your new password.'
      });

    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error resetting password'
      });
    }
  }
};

module.exports = passwordResetController;