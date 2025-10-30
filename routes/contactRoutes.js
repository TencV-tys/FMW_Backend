// routes/contactRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/contact-admin', authMiddleware, async (req, res) => {
  const transaction = await db.transaction();
  
  try {
    const { reason, type, post_id } = req.body;
    const userId = req.user.id;

    if (!reason || !type) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Reason and type are required'
      });
    }

    // Get user info
    const user = await db('users')
      .where('id', userId)
      .select('first_name', 'last_name', 'email')
      .first();

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Create deletion request (MySQL compatible - no .returning())
    const deletionRequestId = await db('deletion_requests')
      .insert({
        user_id: userId,
        post_id: post_id || null,
        reason: reason,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      });

    // For MySQL, we need to get the inserted ID separately
    const deletionRequest = await db('deletion_requests')
      .where('id', deletionRequestId[0])
      .first();

    // Get admins
    const admins = await db('users')
      .where('role', 'admin')
      .select('id', 'email', 'first_name');

    // Create notifications for all admins
    const notifications = admins.map(admin => ({
      user_id: admin.id,
      title: 'New Deletion Request',
      message: `User ${user.first_name} ${user.last_name} requested additional deletion: ${reason.substring(0, 100)}...`,
      type: 'deletion_request',
      metadata: JSON.stringify({
        requesting_user_id: userId,
        requesting_user_name: `${user.first_name} ${user.last_name}`,
        requesting_user_email: user.email,
        reason: reason,
        post_id: post_id,
        request_type: type,
        request_id: deletionRequest.id,
        requested_at: new Date()
      }),
      is_read: false,
      created_at: new Date()
    }));

    await db('notifications').insert(notifications);

    await transaction.commit();

    res.json({
      success: true,
      message: 'Your deletion request has been submitted to administrators',
      request_id: deletionRequest.id
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Contact admin error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error sending request: ' + error.message
    });
  }
});

module.exports = router;