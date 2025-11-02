// routes/contactRoutes.js - Optimized for MySQL
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const emailService = require('../services/emailService');
const { authMiddleware } = require('../middleware/authMiddleware');

// GENERAL CONTACT FORM (No authentication required)
router.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message, category } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address'
      });
    }

    // Get admin emails using Knex
    const admins = await db('users')
      .where('role', 'admin')
      .select('email', 'first_name');

    const adminEmails = admins.map(admin => admin.email);

    // If no admins found, use default admin email
    if (adminEmails.length === 0) {
      adminEmails.push(process.env.ADMIN_EMAIL || process.env.EMAIL_USER);
    }

    // SEND EMAIL TO ADMINS
    const adminEmailPromises = adminEmails.map(adminEmail => 
      emailService.sendNotification(
        adminEmail,
        `New Contact Form: ${subject}`,
        `New contact form submission:\n\nName: ${name}\nEmail: ${email}\nCategory: ${category}\nSubject: ${subject}\nMessage: ${message}\n\nSubmitted: ${new Date().toLocaleString()}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px; background: #FF8904; color: white; padding: 20px; border-radius: 8px;">
              <h1 style="margin: 0;">New Contact Form Submission</h1>
            </div>
            
            <p>A new message has been submitted through the contact form:</p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <h3 style="margin: 0 0 10px 0; color: #333;">Contact Details:</h3>
              <p style="margin: 5px 0;"><strong>Name:</strong> ${name}</p>
              <p style="margin: 5px 0;"><strong>Email:</strong> 
                <a href="mailto:${email}" style="color: #FF8904;">${email}</a>
              </p>
              <p style="margin: 5px 0;"><strong>Category:</strong> ${category}</p>
              <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
              <p style="margin: 5px 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <div style="background-color: white; border: 1px solid #e5e5e5; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <h3 style="margin: 0 0 10px 0; color: #333;">Message:</h3>
              <p style="margin: 0; line-height: 1.6; white-space: pre-wrap;">${message}</p>
            </div>

            <div style="text-align: center; margin: 25px 0;">
              <a href="mailto:${email}" style="background: #FF8904; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Reply to ${name}
              </a>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
              <p>This message was sent from the contact form on your website.</p>
            </div>
          </div>
        `
      )
    );

    // SEND CONFIRMATION EMAIL TO USER
    const userConfirmationEmail = emailService.sendNotification(
      email,
      'We Received Your Message - Community Platform',
      `Hello ${name},\n\nThank you for contacting us! We've received your message and our team will get back to you within 24-48 hours.\n\nMessage Summary:\n- Subject: ${subject}\n- Category: ${category}\n- Submitted: ${new Date().toLocaleString()}\n\nIf you need immediate assistance, please call us at +1 (555) 123-4567.\n\nBest regards,\nThe Community Platform Team`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; background: #10b981; color: white; padding: 30px; border-radius: 8px;">
            <h1 style="margin: 0;">Thank You for Contacting Us!</h1>
          </div>
          
          <div style="padding: 20px 0;">
            <p>Hello <strong>${name}</strong>,</p>
            
            <p>We've received your message and our team will get back to you within 24-48 hours.</p>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #333;">Message Summary</h3>
              <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
              <p style="margin: 5px 0;"><strong>Category:</strong> ${category}</p>
              <p style="margin: 5px 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <p>If you need immediate assistance, please call us at <strong>+1 (555) 123-4567</strong>.</p>
            
            <p>We appreciate you reaching out and will respond as soon as possible.</p>
          </div>
          
          <div style="border-top: 1px solid #e5e5e5; padding-top: 20px; text-align: center; color: #666;">
            <p>Best regards,<br>The Community Platform Team</p>
            <p style="margin-top: 10px; font-size: 12px;">
              This is an automated confirmation. Please do not reply to this email.
            </p>
          </div>
        </div>
      `
    );

    adminEmailPromises.push(userConfirmationEmail);

    // Save contact form submission to database using Knex (MySQL)
    const contactSubmissionResult = await db('contact_submissions')
      .insert({
        name: name,
        email: email,
        subject: subject,
        message: message,
        category: category || 'general',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

    const submissionId = contactSubmissionResult[0];

    // Send all emails
    await Promise.allSettled(adminEmailPromises);

    res.json({
      success: true,
      message: 'Message sent successfully! We will get back to you soon.',
      submission_id: submissionId
    });

  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message. Please try again later.'
    });
  }
});

// DELETION REQUEST ROUTE (MySQL optimized)
router.post('/contact-admin', authMiddleware, async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { reason, type, post_id } = req.body;
    const userId = req.user.id;

    if (!reason || !type) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'Reason and type are required'
      });
    }

    // Get user info using Knex
    const user = await trx('users')
      .where('id', userId)
      .select('first_name', 'last_name', 'email')
      .first();

    if (!user) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Create deletion request using Knex (MySQL)
    const deletionRequestResult = await trx('deletion_requests')
      .insert({
        user_id: userId,
        post_id: post_id || null,
        reason: reason,
        status: 'pending'
      });

    const requestId = deletionRequestResult[0];

    const deletionRequest = await trx('deletion_requests')
      .where('id', requestId)
      .first();

    // Get admins using Knex
    const admins = await trx('users')
      .where('role', 'admin')
      .select('id', 'email', 'first_name');

    // Create notifications for all admins using Knex
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

    await trx('notifications').insert(adminNotifications);

    // CREATE USER CONFIRMATION NOTIFICATION
    const userConfirmationNotification = {
      user_id: userId,
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

    await trx('notifications').insert(userConfirmationNotification);

    // SEND EMAIL NOTIFICATIONS TO ADMINS
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

    // SEND CONFIRMATION EMAIL TO USER
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

    await trx.commit();

    res.json({
      success: true,
      message: 'Your deletion request has been submitted to administrators',
      request_id: deletionRequest.id
    });

  } catch (error) {
    await trx.rollback();
    console.error('Contact admin error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error sending request: ' + error.message
    });
  }
});

module.exports = router;