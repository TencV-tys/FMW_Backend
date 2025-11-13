const express = require('express');
const router = express.Router();
const db = require('../config/db');
const emailService = require('../services/emailService');
const { authMiddleware } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

// Rate limiting to prevent spam
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Too many contact form submissions, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Input sanitization function
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .substring(0, 5000);
};

// Enhanced input validation middleware
const validateContactInput = (req, res, next) => {
  const { name, email, subject, message, category } = req.body;

  // Check if fields exist and are strings
  if (typeof name !== 'string' || typeof email !== 'string' || 
      typeof subject !== 'string' || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid data types'
    });
  }

  // Trim and sanitize ALL inputs
  const sanitizedName = sanitizeInput(name);
  const sanitizedEmail = sanitizeInput(email);
  const sanitizedSubject = sanitizeInput(subject);
  const sanitizedMessage = sanitizeInput(message);
  const sanitizedCategory = ['general', 'technical', 'account', 'report', 'suggestion', 'partnership']
    .includes(category) ? category : 'general';

  // Check if fields are not empty after sanitization
  if (!sanitizedName || !sanitizedEmail || !sanitizedSubject || !sanitizedMessage) {
    return res.status(400).json({
      success: false,
      error: 'All fields are required and cannot be empty'
    });
  }

  // Enhanced email validation
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(sanitizedEmail)) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid email address'
    });
  }

  // Validate name length
  if (sanitizedName.length < 2 || sanitizedName.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'Name must be between 2 and 100 characters'
    });
  }

  // Validate subject length
  if (sanitizedSubject.length < 5 || sanitizedSubject.length > 200) {
    return res.status(400).json({
      success: false,
      error: 'Subject must be between 5 and 200 characters'
    });
  }

  // Validate message length
  if (sanitizedMessage.length < 10) {
    return res.status(400).json({
      success: false,
      error: 'Message must be at least 10 characters long'
    });
  }

  if (sanitizedMessage.length > 2000) {
    return res.status(400).json({
      success: false,
      error: 'Message must not exceed 2000 characters'
    });
  }

  // Add validated and SANITIZED data to request
  req.validatedData = {
    name: sanitizedName,
    email: sanitizedEmail.toLowerCase(),
    subject: sanitizedSubject,
    message: sanitizedMessage,
    category: sanitizedCategory
  };

  next();
};

// SECURE CONTACT FORM with rate limiting
router.post('/contact', contactLimiter, validateContactInput, async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { name, email, subject, message, category } = req.validatedData;

    // Check for duplicate submissions from same IP in last 5 minutes
    const recentSubmission = await trx('contact_submissions')
      .where('ip_address', req.ip)
      .where('created_at', '>', db.raw('DATE_SUB(NOW(), INTERVAL 5 MINUTE)'))
      .first();

    if (recentSubmission) {
      await trx.rollback();
      return res.status(429).json({
        success: false,
        error: 'Please wait before submitting another message'
      });
    }

    // Get admin emails securely
    const admins = await trx('users')
      .where('role', 'admin')
      .where('status', 'active')
      .select('email', 'first_name');

    const adminEmails = admins.map(admin => admin.email);

    if (adminEmails.length === 0) {
      adminEmails.push(process.env.ADMIN_EMAIL || process.env.EMAIL_USER);
    }

    // Save contact form submission to database
    const [submissionId] = await trx('contact_submissions').insert({
      name: name,
      email: email,
      subject: subject,
      message: message,
      category: category,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent') || 'Unknown',
      created_at: new Date()
    });

    // SEND EMAIL TO ADMINS
    const adminEmailPromises = adminEmails.map(adminEmail => 
      emailService.sendNotification(
        adminEmail,
        `New Contact Form: ${subject}`,
        `New contact form submission:\n\nName: ${name}\nEmail: ${email}\nCategory: ${category}\nSubject: ${subject}\nMessage: ${message}\n\nSubmitted: ${new Date().toLocaleString()}\nIP: ${req.ip}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 20px; border-radius: 8px;">
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
              <p style="margin: 5px 0;"><strong>IP Address:</strong> ${req.ip}</p>
              <p style="margin: 5px 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
              <p style="margin: 5px 0;"><strong>Submission ID:</strong> #${submissionId}</p>
            </div>

            <div style="background-color: white; border: 1px solid #e5e5e5; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <h3 style="margin: 0 0 10px 0; color: #333;">Message:</h3>
              <p style="margin: 0; line-height: 1.6;">${message}</p>
            </div>

            <div style="text-align: center; margin: 25px 0;">
              <a href="mailto:${email}" style="background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
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
      `Hello ${name},\n\nThank you for contacting us! We've received your message and our team will get back to you within 24-48 hours.\n\nMessage Summary:\n- Subject: ${subject}\n- Category: ${category}\n- Submitted: ${new Date().toLocaleString()}\n- Submission ID: #${submissionId}\n\nIf you need immediate assistance, please call us at +1 (555) 123-4567.\n\nBest regards,\nThe Community Platform Team`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 20px; border-radius: 8px;">
            <h1 style="margin: 0;">Thank You for Contacting Us!</h1>
          </div>
          
          <div style="padding: 20px 0;">
            <p>Hello <strong>${name}</strong>,</p>
            
            <p>We've received your message and our team will get back to you within 24-48 hours.</p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #333;">Message Summary</h3>
              <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
              <p style="margin: 5px 0;"><strong>Category:</strong> ${category}</p>
              <p style="margin: 5px 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
              <p style="margin: 5px 0;"><strong>Reference ID:</strong> #${submissionId}</p>
            </div>
            
            <p>If you need immediate assistance, please call us at <strong>+1 (555) 123-4567</strong>.</p>
            
            <p>We appreciate you reaching out and will respond as soon as possible.</p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
            <p>Best regards,<br>The Community Platform Team</p>
            <p style="margin-top: 10px; font-size: 12px;">
              This is an automated confirmation. Please do not reply to this email.
            </p>
          </div>
        </div> 
      `
    );

    adminEmailPromises.push(userConfirmationEmail);

    // Send all emails
    const emailResults = await Promise.allSettled(adminEmailPromises);

    await trx.commit();

    res.json({
      success: true,
      message: 'Message sent successfully! We will get back to you soon.',
      submission_id: submissionId,
      email_sent: emailResults.filter(result => result.status === 'fulfilled').length > 0
    });

  } catch (error) {
    await trx.rollback();
    res.status(500).json({
      success: false,
      error: 'Failed to send message. Please try again later.'
    });
  }
});

// DELETION REQUEST ROUTE
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

    // Check for existing pending request
    if (post_id) {
      const existingRequest = await trx('deletion_requests')
        .where('user_id', userId)
        .where('post_id', post_id)
        .where('status', 'pending')
        .first();

      if (existingRequest) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          error: 'You already have a pending deletion request for this post'
        });
      }
    }

    // Get user info
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

    // Create deletion request
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

    // Get admins
    const admins = await trx('users')
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

    await trx('notifications').insert(adminNotifications);

    // Create user confirmation notification
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

    // Send email notifications to admins
    const adminEmails = admins.map(admin => admin.email);
    const emailPromises = adminEmails.map(adminEmail => 
      emailService.sendNotification(
        adminEmail,
        'New Deletion Request - Action Required',
        `User ${user.first_name} ${user.last_name} (${user.email}) has submitted a deletion request.\n\nReason: ${reason}\nRequest ID: #${deletionRequest.id}\n\nPlease review this request in the admin panel.`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 20px; border-radius: 8px;">
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
              <a href="http://localhost:5173/admin/deletion-requests" style="background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
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

    // Send confirmation email to user
    const userConfirmationEmail = emailService.sendNotification(
      user.email,
      'Deletion Request Submitted Successfully',
      `Hello ${user.first_name},\n\nYour deletion request has been submitted successfully.\n\nRequest Details:\n- Request ID: #${deletionRequest.id}\n- Reason: ${reason}\n- Status: Under Review\n\nWe will review your request and notify you once it's processed.\n\nThank you for your patience.`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 20px; border-radius: 8px;">
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
    res.status(500).json({
      success: false,
      error: 'Server error sending request: ' + error.message
    });
  } 
});

// Endpoint to check if user has pending deletion request for a post
router.get('/check-pending-deletion/:postId', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const pendingRequest = await db('deletion_requests')
      .where('user_id', userId)
      .where('post_id', postId)
      .where('status', 'pending')
      .first();

    res.json({
      success: true,
      hasPendingRequest: !!pendingRequest,
      request: pendingRequest ? {
        id: pendingRequest.id,
        reason: pendingRequest.reason,
        created_at: pendingRequest.created_at
      } : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error checking pending request'
    });
  }
});

module.exports = router;