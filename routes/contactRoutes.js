// routes/contactRoutes.js - Updated version with email notifications
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const emailService = require('../services/emailService');
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

    // Create deletion request
    const deletionRequestId = await db('deletion_requests')
      .insert({
        user_id: userId,
        post_id: post_id || null,
        reason: reason,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      });

    // For MySQL, get the inserted ID separately
    const deletionRequest = await db('deletion_requests')
      .where('id', deletionRequestId[0])
      .first();

    // Get admins
    const admins = await db('users')
      .where('role', 'admin')
      .select('id', 'email', 'first_name');

    // Create notifications for all admins
    const adminNotifications = admins.map(admin => ({
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

    await db('notifications').insert(adminNotifications);

    // ✅ CREATE USER CONFIRMATION NOTIFICATION
    const userConfirmationNotification = {
      user_id: userId, // This goes to the USER who made the request
      title: 'Deletion Request Submitted',
      message: `Your deletion request has been submitted to administrators. We'll review it and notify you once processed. Request ID: #${deletionRequest.id}`,
      type: 'deletion_request_submitted',
      metadata: JSON.stringify({
        request_id: deletionRequest.id,
        reason: reason,
        submitted_at: new Date(),
        status: 'pending_review'
      }),
      is_read: false,
      created_at: new Date()
    };

    await db('notifications').insert(userConfirmationNotification);

    // ✅ SEND EMAIL NOTIFICATIONS TO ADMINS
    const adminEmails = admins.map(admin => admin.email);
    const emailPromises = adminEmails.map(adminEmail => 
      emailService.sendNotification(
        adminEmail,
        'New Deletion Request - Action Required',
        `User ${user.first_name} ${user.last_name} (${user.email}) has submitted a deletion request.\n\nReason: ${reason}\nRequest ID: #${deletionRequest.id}\n\nPlease review this request in the admin panel.`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px; background: #FF8904; color: white; padding: 20px; border-radius: 8px;">
              <h1 style="margin: 0;">New Deletion Request</h1>
            </div>
            
            <p>A new deletion request has been submitted and requires your attention.</p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <h3 style="margin: 0 0 10px 0; color: #333;">Request Details:</h3>
              <p style="margin: 5px 0;"><strong>User:</strong> ${user.first_name} ${user.last_name} (${user.email})</p>
              <p style="margin: 5px 0;"><strong>Reason:</strong> ${reason}</p>
              <p style="margin: 5px 0;"><strong>Request ID:</strong> #${deletionRequest.id}</p>
              <p style="margin: 5px 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
              ${post_id ? `<p style="margin: 5px 0;"><strong>Post ID:</strong> ${post_id}</p>` : ''}
            </div>
            
            <p>Please review this request in the admin panel and take appropriate action.</p>
            
            <div style="text-align: center; margin: 25px 0;">
              <a href="http://localhost:5173/admin/deletion-requests" style="background: #FF8904; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Review Request
              </a>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
              <p>Best regards,<br>The Community Platform</p>
            </div>
          </div>
        `
      )
    );

    // ✅ SEND CONFIRMATION EMAIL TO USER
    const userConfirmationEmail = emailService.sendNotification(
      user.email,
      'Deletion Request Submitted Successfully',
      `Hello ${user.first_name},\n\nYour deletion request has been submitted successfully.\n\nRequest Details:\n- Request ID: #${deletionRequest.id}\n- Reason: ${reason}\n- Status: Under Review\n\nWe will review your request and notify you once it's processed.\n\nThank you for your patience.`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 20px; background: #10b981; color: white; padding: 20px; border-radius: 8px;">
            <h1 style="margin: 0;">Deletion Request Submitted</h1>
          </div>
          
          <p>Hello <strong>${user.first_name}</strong>,</p>
          
          <p>Your deletion request has been submitted successfully and is now under review by our admin team.</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Request Details:</h3>
            <p style="margin: 5px 0;"><strong>Request ID:</strong> #${deletionRequest.id}</p>
            <p style="margin: 5px 0;"><strong>Reason:</strong> ${reason}</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> Under Review</p>
            <p style="margin: 5px 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <p>We will review your request and notify you once it's processed. This may take 24-48 hours.</p>
          
          <p>Thank you for your patience and for using our platform.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
            <p>Best regards,<br>The Community Platform Team</p>
          </div>
        </div>
      `
    );

    emailPromises.push(userConfirmationEmail);
    await Promise.allSettled(emailPromises);

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