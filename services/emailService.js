// services/emailService.js - COMPLETE VERSION
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

  // NEW: Password Reset Email
  sendPasswordResetEmail: async (userEmail, userName, resetToken) => {
    const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;
    const subject = 'Password Reset Request - Community Platform';
    const message = `Hello ${userName},\n\nYou requested to reset your password. Use this link to reset your password: ${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe Admin Team`;
    
    const htmlContent = emailTemplates.passwordReset(userName, resetLink, '1 hour');

    return await emailService.sendNotification(userEmail, subject, message, htmlContent);
  }
};

module.exports = emailService;