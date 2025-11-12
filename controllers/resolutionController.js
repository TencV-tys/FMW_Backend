// controllers/resolutionController.js
const db = require('../config/db');
const emailService = require('../services/emailService');

const resolutionController = {
  // User submits resolution request
  submitResolutionRequest: async (req, res) => {
    try {
      const { id } = req.params;
      const { resolution_description, verification_details } = req.body;

      // Validate required fields
      if (!resolution_description) {
        return res.status(400).json({
          success: false,
          error: 'Resolution description is required'
        });
      }
         // 🆕 ADD: File upload error handling
    if (req.fileValidationError) {
      return res.status(400).json({
        success: false,
        error: req.fileValidationError
      });
    }

    // 🆕 ADD: File size validation
    if (req.file && req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum 5MB allowed.'
      });
    }
      // Check if post exists and belongs to user
      const post = await db('posts')
        .where('id', id)
        .first();

      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found'
        }); 
      }

      if (post.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only submit resolution requests for your own posts.'
        });
      }

      // Check if post is already resolved
      if (post.status === 'Resolved') {
        return res.status(400).json({
          success: false,
          error: 'This post is already marked as resolved'
        });
      }

      // Check if there's already a pending request
      const existingRequest = await db('resolution_requests')
        .where('post_id', id)
        .where('status', 'pending')
        .first();

      if (existingRequest) {
        return res.status(400).json({
          success: false,
          error: 'There is already a pending resolution request for this post'
        });
      }

      // Handle file upload
      let resolution_photo = null;
      if (req.file) {
        resolution_photo = req.file.filename;
      }

      // Create resolution request
      const [requestId] = await db('resolution_requests').insert({
        post_id: id,
        user_id: req.user.id,
        resolution_description,
        resolution_photo,
        verification_details: verification_details || null,
        status: 'pending'
      });

      // Get the complete request data with user and post info
      const newRequest = await db('resolution_requests as rr')
        .join('posts as p', 'rr.post_id', 'p.id')
        .join('users as u', 'rr.user_id', 'u.id')
        .select(
          'rr.*',
          'p.title as post_title',
          'p.type as post_type',
          'p.description as post_description',
          'u.first_name',
          'u.last_name',
          'u.email'
        )
        .where('rr.id', requestId)
        .first();

      // 🆕 NOTIFY USER about submission (in-app notification)
      const userNotification = {
        user_id: req.user.id,
        title: 'Resolution Request Submitted',
        message: `Your resolution request for post "${post.title}" has been submitted and is pending admin review.`,
        type: 'resolution_request_submitted',
        metadata: JSON.stringify({
          request_id: requestId,
          post_id: post.id,
          post_title: post.title,
          submitted_at: new Date()
        }),
        is_read: false,
        created_at: new Date()
      };
      await db('notifications').insert(userNotification);

      // 🆕 SEND EMAIL to user
      if (emailService && emailService.sendNotification) {
        await emailService.sendNotification(
          req.user.email,
          'Resolution Request Submitted',
          `Hello ${req.user.first_name},\n\nYour resolution request for post "${post.title}" has been submitted successfully.\n\nWe will review your request and notify you once it's processed.\n\nThank you for your patience.`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
              <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 20px; border-radius: 8px;">
                <h1 style="margin: 0;">Resolution Request Submitted</h1>
              </div>
              
              <p>Hello <strong>${req.user.first_name}</strong>,</p>
              
              <p>Your resolution request has been submitted successfully and is now under review by our admin team.</p>
              
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <h3 style="margin: 0 0 10px 0; color: #333;">Request Details:</h3>
                <p style="margin: 5px 0;"><strong>Post:</strong> ${post.title}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> Under Review</p>
                <p style="margin: 5px 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
              </div>
              
              <p>We'll review your request and notify you once processed (24-48 hours).</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
                <p>Best regards,<br>The Community Platform Team</p>
              </div>
            </div>
          ` 
        );
      }

      // 🆕 ENHANCED: Notify all admins with complete request details
      await resolutionController._notifyAdminsAboutResolutionRequest(newRequest);

      res.json({
        success: true,
        message: 'Resolution request submitted successfully! Waiting for admin approval.',
        requestId
      });

    } catch (error) {
      console.error('Submit resolution request error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error submitting resolution request'
      });
    }
  },

  // Admin gets all pending resolution requests
getPendingResolutionRequests: async (req, res) => {
  try {
    const requests = await db('resolution_requests as rr')
      .join('posts as p', 'rr.post_id', 'p.id')
      .join('users as u', 'rr.user_id', 'u.id')
      .join('categories as c', 'p.category_id', 'c.id')
      .select(
        'rr.*',
        'p.title as post_title',
        'p.type as post_type',
        'p.description as post_description',
        'p.photo as post_photo',
        'p.created_at as post_created_at',
        'u.first_name',
        'u.last_name',
        'u.email',
        // 'u.phone', // REMOVED - this was causing the error
        'c.name as category_name'
      )
      .where('rr.status', 'pending')
      .orderBy('rr.created_at', 'desc');

    // Count total pending requests
    const pendingCount = await db('resolution_requests')
      .where('status', 'pending')
      .count('id as count')
      .first();

    res.json({ 
      success: true,
      requests,
      pendingCount: pendingCount.count || 0
    });
  } catch (error) {
    console.error('Get pending resolution requests error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching resolution requests'
    });
  }
},

// Admin approves resolution request
approveResolutionRequest: async (req, res) => {
  try {
    const { requestId } = req.params;
    const { admin_notes } = req.body || {};

    const request = await db('resolution_requests as rr')
      .join('posts as p', 'rr.post_id', 'p.id')
      .join('users as u', 'rr.user_id', 'u.id')
      .select('rr.*', 'p.title as post_title', 'u.first_name', 'u.last_name', 'u.email')
      .where('rr.id', requestId)
      .first();

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Resolution request not found'
      });
    }

    // Update resolution request status
    await db('resolution_requests')
      .where('id', requestId)
      .update({
        status: 'approved',
        admin_notes: admin_notes || null,
        updated_at: new Date()
      });

    // 🆕 FIXED: Only update post status to resolved (remove ALL non-existent fields)
    await db('posts')
      .where('id', request.post_id)
      .update({
        status: 'Resolved',
        updated_at: new Date()
        // REMOVED: resolved_at, resolution_description, resolution_photo, verification_details
      });

    // 🆕 CREATE ADMIN NOTIFICATION for approval action
    const adminNotification = {
      user_id: req.user.id,
      title: 'Resolution Request Approved',
      message: `You approved the resolution request for post "${request.post_title}" from ${request.first_name} ${request.last_name}`,
      type: 'resolution_approved_admin',
      metadata: JSON.stringify({
        request_id: requestId,
        post_id: request.post_id,
        post_title: request.post_title,
        user_id: request.user_id,
        user_name: `${request.first_name} ${request.last_name}`,
        approved_by: req.user.id,
        approved_by_name: `${req.user.first_name} ${req.user.last_name}`,
        approved_at: new Date()
      }),
      is_read: false,
      created_at: new Date()
    };
    await db('notifications').insert(adminNotification);

    // Notify user about approval (BOTH in-app AND email)
    await resolutionController._notifyUserAboutResolutionApproval(request, req.user);

    res.json({
      success: true,
      message: 'Resolution request approved! Post marked as resolved.'
    });

  } catch (error) {
    console.error('Approve resolution request error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error approving resolution request'
    });
  }
},
  // Admin rejects resolution request
  rejectResolutionRequest: async (req, res) => {
    try {
      const { requestId } = req.params;
      const { admin_notes } = req.body || {};

      const request = await db('resolution_requests as rr')
        .join('posts as p', 'rr.post_id', 'p.id')
        .join('users as u', 'rr.user_id', 'u.id')
        .select('rr.*', 'p.title as post_title', 'u.first_name', 'u.last_name', 'u.email')
        .where('rr.id', requestId)
        .first();

      if (!request) {
        return res.status(404).json({
          success: false,
          error: 'Resolution request not found'
        });
      }

      // Update resolution request status
      await db('resolution_requests')
        .where('id', requestId)
        .update({
          status: 'rejected',
          admin_notes: admin_notes || 'Request rejected by administrator',
          updated_at: new Date()
        });

      // 🆕 CREATE ADMIN NOTIFICATION for rejection action
      const adminNotification = {
        user_id: req.user.id,
        title: 'Resolution Request Rejected',
        message: `You rejected the resolution request for post "${request.post_title}" from ${request.first_name} ${request.last_name}`,
        type: 'resolution_rejected_admin',
        metadata: JSON.stringify({
          request_id: requestId,
          post_id: request.post_id,
          post_title: request.post_title,
          user_id: request.user_id,
          user_name: `${request.first_name} ${request.last_name}`,
          rejected_by: req.user.id,
          rejected_by_name: `${req.user.first_name} ${req.user.last_name}`,
          rejected_at: new Date(),
          reason: admin_notes
        }),
        is_read: false,
        created_at: new Date()
      };
      await db('notifications').insert(adminNotification);

      // Notify user about rejection (BOTH in-app AND email)
      await resolutionController._notifyUserAboutResolutionRejection(request, req.user);

      res.json({
        success: true,
        message: 'Resolution request rejected.'
      });

    } catch (error) {
      console.error('Reject resolution request error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error rejecting resolution request'
      });
    }
  },

  // Get user's resolution request history
  getUserResolutionRequests: async (req, res) => {
    try {
      const requests = await db('resolution_requests as rr')
        .join('posts as p', 'rr.post_id', 'p.id')
        .select(
          'rr.*',
          'p.title as post_title',
          'p.type as post_type',
          'p.status as post_status'
        )
        .where('rr.user_id', req.user.id)
        .orderBy('rr.created_at', 'desc');

      res.json({
        success: true,
        requests
      });
    } catch (error) {
      console.error('Get user resolution requests error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching resolution requests'
      });
    }
  },

  // 🆕 ENHANCED: Notify admins about new resolution request with detailed information
  _notifyAdminsAboutResolutionRequest: async (request) => {
    try {
      const adminUsers = await db('users').where('role', 'admin').select('id', 'email', 'first_name');
      const currentTime = new Date();
      const notificationsToInsert = [];

      for (const admin of adminUsers) {
        // 🆕 ENHANCED: More detailed in-app notification
        const notificationData = {
          user_id: admin.id,
          title: '🆕 New Resolution Request Submitted',
          message: `User ${request.first_name} ${request.last_name} submitted a resolution request for "${request.post_title}". Action required.`,
          type: 'resolution_request_pending',
          metadata: JSON.stringify({
            request_id: request.id,
            post_id: request.post_id,
            post_title: request.post_title,
            post_type: request.post_type,
            user_id: request.user_id,
            user_name: `${request.first_name} ${request.last_name}`,
            user_email: request.email,
            resolution_description: request.resolution_description,
            verification_details: request.verification_details,
            submitted_at: currentTime,
            priority: 'high'
          }),
          is_read: false,
          created_at: currentTime
        };
        notificationsToInsert.push(notificationData);

        // 🆕 ENHANCED: More detailed email notification to admin
        if (emailService && emailService.sendNotification) {
          await emailService.sendNotification(
            admin.email,
            '🚨 New Resolution Request Requires Your Attention',
            `
NEW RESOLUTION REQUEST SUBMITTED

User: ${request.first_name} ${request.last_name} (${request.email})
Post: "${request.post_title}"
Type: ${request.post_type}
Submitted: ${currentTime.toLocaleString()}

Resolution Description:
${request.resolution_description}

${request.verification_details ? `Verification Details: ${request.verification_details}` : ''}

Please review this request in the admin panel as soon as possible.

Thank you,
Community Platform Team
            `,
            `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px; background: #fff;">
              <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 20px; border-radius: 8px;">
                <h1 style="margin: 0;">🚨 New Resolution Request</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Action Required - Pending Admin Review</p>
              </div>
              
              <div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 15px 0;">
                <h3 style="margin: 0 0 10px 0; color: #92400e;">📋 Request Summary</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #fed7aa;"><strong>👤 User:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #fed7aa;">${request.first_name} ${request.last_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #fed7aa;"><strong>📧 Email:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #fed7aa;">${request.email}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #fed7aa;"><strong>📝 Post Title:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #fed7aa;">${request.post_title}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #fed7aa;"><strong>📂 Post Type:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #fed7aa;">${request.post_type}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>⏰ Submitted:</strong></td>
                    <td style="padding: 8px 0;">${currentTime.toLocaleString()}</td>
                  </tr>
                </table>
              </div>

              <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <h3 style="margin: 0 0 10px 0; color: #333;">📄 Resolution Description</h3>
                <p style="margin: 0; white-space: pre-wrap;">${request.resolution_description}</p>
              </div>

              ${request.verification_details ? `
              <div style="background-color: #f0f9ff; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <h3 style="margin: 0 0 10px 0; color: #0369a1;">🔍 Verification Details</h3>
                <p style="margin: 0; white-space: pre-wrap;">${request.verification_details}</p>
              </div>
              ` : ''}

              <div style="text-align: center; margin: 25px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/resolution-requests" 
                   style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
                  🔍 Review Resolution Request
                </a>
              </div>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
                <p style="margin: 0;">This is an automated notification. Please do not reply to this email.</p>
                <p style="margin: 5px 0 0 0;">Best regards,<br><strong>The Community Platform Team</strong></p>
              </div>
            </div>
            `
          );
        }
      }

      if (notificationsToInsert.length > 0) {
        await db('notifications').insert(notificationsToInsert);
      }

      console.log(`✅ Notified ${adminUsers.length} admins about NEW resolution request ${request.id}`);
    } catch (error) {
      console.error('Error notifying admins about resolution request:', error);
    }
  },

  // Notify user about resolution approval (BOTH in-app AND email)
  _notifyUserAboutResolutionApproval: async (request, adminUser) => {
    try {
      const currentTime = new Date();
      
      // In-app notification
      const notificationData = {
        user_id: request.user_id,
        title: 'Resolution Request Approved',
        message: `Your resolution request for post "${request.post_title}" has been approved. The post is now marked as resolved.`,
        type: 'resolution_request_approved',
        metadata: JSON.stringify({
          request_id: request.id,
          post_id: request.post_id,
          post_title: request.post_title,
          approved_by: adminUser.id,
          approved_by_name: `${adminUser.first_name} ${adminUser.last_name}`,
          approved_at: currentTime
        }),
        is_read: false,
        created_at: currentTime
      };

      await db('notifications').insert(notificationData);

      // 🆕 EMAIL notification to user
      if (emailService && emailService.sendNotification) {
        await emailService.sendNotification(
          request.email,
          'Resolution Request Approved',
          `Hello ${request.first_name},\n\nYour resolution request for post "${request.post_title}" has been approved.\n\nThe post has been marked as resolved and is now complete.\n\nThank you for using our platform!`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
              <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 20px; border-radius: 8px;">
                <h1 style="margin: 0;">Resolution Request Approved</h1>
              </div>
              
              <p>Hello <strong>${request.first_name}</strong>,</p>
              
              <p>Great news! Your resolution request has been approved by the administrator.</p>
              
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <h3 style="margin: 0 0 10px 0; color: #333;">Request Details:</h3>
                <p style="margin: 5px 0;"><strong>Post:</strong> ${request.post_title}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> Approved</p>
                <p style="margin: 5px 0;"><strong>Approved:</strong> ${currentTime.toLocaleString()}</p>
                <p style="margin: 5px 0;"><strong>Approved by:</strong> ${adminUser.first_name} ${adminUser.last_name}</p>
              </div>
              
              <p>The post has been successfully marked as resolved and is now complete.</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
                <p>Best regards,<br>The Community Platform Team</p>
              </div>
            </div>
          `
        );
      }

      console.log(`✅ Notified user ${request.user_id} about resolution approval`);
    } catch (error) {
      console.error('Error notifying user about resolution approval:', error);
    }
  },

  // Notify user about resolution rejection (BOTH in-app AND email)
  _notifyUserAboutResolutionRejection: async (request, adminUser) => {
    try {
      const currentTime = new Date();
      
      // In-app notification
      const notificationData = {
        user_id: request.user_id,
        title: 'Resolution Request Rejected',
        message: `Your resolution request for post "${request.post_title}" was rejected.${request.admin_notes ? ` Reason: ${request.admin_notes}` : ''}`,
        type: 'resolution_request_rejected',
        metadata: JSON.stringify({
          request_id: request.id,
          post_id: request.post_id,
          post_title: request.post_title,
          rejected_by: adminUser.id,
          rejected_by_name: `${adminUser.first_name} ${adminUser.last_name}`,
          rejected_at: currentTime,
          reason: request.admin_notes
        }),
        is_read: false,
        created_at: currentTime
      };

      await db('notifications').insert(notificationData);

      // 🆕 EMAIL notification to user
      if (emailService && emailService.sendNotification) {
        await emailService.sendNotification(
          request.email,
          'Resolution Request Rejected',
          `Hello ${request.first_name},\n\nYour resolution request for post "${request.post_title}" was rejected.\n\n${request.admin_notes ? `Reason: ${request.admin_notes}\n\n` : ''}If you have any questions, please contact our support team.`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
              <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 20px; border-radius: 8px;">
                <h1 style="margin: 0;">Resolution Request Rejected</h1>
              </div>
              
              <p>Hello <strong>${request.first_name}</strong>,</p>
              
              <p>Your resolution request has been reviewed and unfortunately could not be approved at this time.</p>
              
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <h3 style="margin: 0 0 10px 0; color: #333;">Request Details:</h3>
                <p style="margin: 5px 0;"><strong>Post:</strong> ${request.post_title}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> Rejected</p>
                <p style="margin: 5px 0;"><strong>Rejected:</strong> ${currentTime.toLocaleString()}</p>
                ${request.admin_notes ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${request.admin_notes}</p>` : ''}
              </div>
              
              <p>If you have any questions or believe this was done in error, please contact our support team.</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
                <p>Best regards,<br>The Community Platform Team</p>
              </div>
            </div>
          `
        );
      }

      console.log(`✅ Notified user ${request.user_id} about resolution rejection`);
    } catch (error) {
      console.error('Error notifying user about resolution rejection:', error);
    }
  }
};

module.exports = resolutionController;