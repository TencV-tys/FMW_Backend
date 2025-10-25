// services/emailService.js - COMPLETE VERSION WITH REPORTS
const nodemailer = require('nodemailer');
const emailTemplates = require('./emailTemplates');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const emailService = {
  sendNotification: async (to, subject, message, htmlContent = null) => {
    try {
      const mailOptions = {
        from: `"Community Platform" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: subject,
        text: message,
        html: htmlContent
      };

      const result = await transporter.sendMail(mailOptions);
     
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  },

  // USING POST ACTION TEMPLATE
  sendPostActionNotification: async (userEmail, userName, action, postTitle, reason = '') => {
    const actions = {
      deleted: 'permanently deleted',
      removed: 'removed from public view',
      resolved: 'marked as resolved',
      restored: 'restored'
    };

    const subject = `Your Post Has Been ${actions[action]}`;
    const message = `Hello ${userName},\n\nYour post "${postTitle}" has been ${actions[action]} by the administrator.${reason ? `\nReason: ${reason}` : ''}\n\nThank you for using our platform.\n\nBest regards,\nThe Admin Team`;
    
    const htmlContent = emailTemplates.postAction(userName, postTitle, action, reason);

    return await emailService.sendNotification(userEmail, subject, message, htmlContent);
  },

  // USING USER STATUS TEMPLATE
  sendUserStatusNotification: async (userEmail, userName, status, reason = '', duration = '') => {
    const statusMessages = {
      suspended: 'suspended',
      banned: 'permanently banned',
      activated: 'activated',
      deleted: 'permanently deleted'
    };

    const subject = `Account ${statusMessages[status]}`;
    const message = `Hello ${userName},\n\nYour account has been ${statusMessages[status]} by the administrator.${reason ? `\nReason: ${reason}` : ''}${duration ? `\nDuration: ${duration} day(s)` : ''}\n\nIf you have any questions, please contact our support team.\n\nBest regards,\nThe Admin Team`;
    
    const htmlContent = emailTemplates.userStatus(userName, status, reason, duration);

    return await emailService.sendNotification(userEmail, subject, message, htmlContent);
  },

  // PASSWORD RESET EMAIL
  sendPasswordResetEmail: async (userEmail, userName, resetToken) => {
    const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;
    const subject = 'Password Reset Request - Community Platform';
    const message = `Hello ${userName},\n\nYou requested to reset your password. Use this link to reset your password: ${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe Admin Team`;
    
    const htmlContent = emailTemplates.passwordReset(userName, resetLink, '1 hour');

    return await emailService.sendNotification(userEmail, subject, message, htmlContent);
  },

  // NEW: REPORT SUBMITTED EMAIL
  sendReportSubmittedEmail: async (userEmail, userName, postTitle, reason, additionalInfo = '', reportId) => {
    const subject = 'Report Submitted Successfully - Community Platform';
    const message = `Hello ${userName},\n\nYour report has been submitted successfully and is now under review by our admin team.\n\nReport Details:\n- Post: "${postTitle}"\n- Reason: ${reason}\n${additionalInfo ? `- Additional Info: ${additionalInfo}\n` : ''}- Report ID: #${reportId}\n- Status: Under Review\n\nWe will review your report and take appropriate action. You will be notified of any updates.\n\nThank you for helping us maintain a safe community.\n\nBest regards,\nThe Community Platform Team`;
    
    const htmlContent = emailTemplates.reportSubmitted(userName, postTitle, reason, additionalInfo, reportId);

    return await emailService.sendNotification(userEmail, subject, message, htmlContent);
  },

  // NEW: REPORT STATUS UPDATE EMAIL
  sendReportStatusUpdate: async (userEmail, userName, postTitle, status, reason, adminNote = '', reportId) => {
    const statusMessages = {
      pending: 'reopened and is pending review',
      under_review: 'is now under review',
      resolved: 'has been resolved',
      dismissed: 'has been dismissed'
    };

    const subject = `Report ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')} - Community Platform`;
    const message = `Hello ${userName},\n\nYour report for the post "${postTitle}" has been ${statusMessages[status]}.\n\nReport Details:\n- Post: "${postTitle}"\n- Your Reason: ${reason}\n- Current Status: ${status}\n${adminNote ? `- Admin Note: ${adminNote}\n` : ''}- Report ID: #${reportId}\n\nThank you for your contribution to our community.\n\nBest regards,\nThe Admin Team`;
    
    const htmlContent = emailTemplates.reportStatusUpdate(userName, postTitle, status, reason, adminNote, reportId);

    return await emailService.sendNotification(userEmail, subject, message, htmlContent);
  },

  // NEW: ADMIN REPORT NOTIFICATION
  sendAdminReportNotification: async (adminEmail, adminName, postTitle, reason, additionalInfo = '', reportId, reporterName) => {
    const subject = 'New Report Submitted - Action Required';
    const message = `Hello ${adminName},\n\nA new report has been submitted for the post "${postTitle}".\n\nReport Details:\n- Post: "${postTitle}"\n- Reason: ${reason}\n${additionalInfo ? `- Additional Info: ${additionalInfo}\n` : ''}- Reporter: ${reporterName}\n- Report ID: #${reportId}\n\nPlease review this report in the admin panel.\n\nBest regards,\nThe Community Platform`;
    
    const htmlContent = emailTemplates.adminReportNotification(adminName, postTitle, reason, additionalInfo, reportId, reporterName);

    return await emailService.sendNotification(adminEmail, subject, message, htmlContent);
  }
};

module.exports = emailService;