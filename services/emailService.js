const nodemailer = require('nodemailer');
const emailTemplates = require('./emailTemplates');
const FrontendUrl = require('../config/FrontEndUrl.js');

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
      deleted: 'permanently deleted',
      restored: 'restored'
    };

    const subject = `Account ${statusMessages[status]}`;
    const message = `Hello ${userName},\n\nYour account has been ${statusMessages[status]} by the administrator.${reason ? `\nReason: ${reason}` : ''}${duration ? `\nDuration: ${duration} day(s)` : ''}\n\nIf you have any questions, please contact our support team.\n\nBest regards,\nThe Admin Team`;
    
    const htmlContent = emailTemplates.userStatus(userName, status, reason, duration);

    return await emailService.sendNotification(userEmail, subject, message, htmlContent);
  },

  // PASSWORD RESET EMAIL
  sendPasswordResetEmail: async (userEmail, userName, resetToken) => {
    const baseUrl = FrontendUrl();
    
    const encodedToken = encodeURIComponent(resetToken);
    const resetLink = `${baseUrl}/reset-password?token=${encodedToken}`;
    
    const subject = 'Password Reset Request - Community Platform';
    const message = `Hello ${userName},\n\nYou requested to reset your password. Use this link to reset your password: ${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe Admin Team`;
    
    const htmlContent = emailTemplates.passwordReset(userName, resetLink, '1 hour');

    return await emailService.sendNotification(userEmail, subject, message, htmlContent);
  },

  // REPORT SUBMITTED EMAIL WITH MONTHLY COUNTS
  sendReportSubmittedEmail: async (userEmail, userName, postTitle, reason, additionalInfo = '', reportId, monthlyReportCount = 0, totalReportCount = 0) => {
    const subject = 'Report Submitted Successfully - Community Platform';
    const message = `Hello ${userName},\n\nYour report has been submitted successfully and is now under review by our admin team.\n\nReport Details:\n- Post: "${postTitle}"\n- Reason: ${reason}\n${additionalInfo ? `- Additional Info: ${additionalInfo}\n` : ''}- Report ID: #${reportId}\n- Monthly Reports: ${monthlyReportCount}\n- Total Reports: ${totalReportCount}\n- Status: Under Review\n\nWe will review your report and take appropriate action. You will be notified of any updates.\n\nThank you for helping us maintain a safe community.\n\nBest regards,\nThe Community Platform Team`;
    
    const htmlContent = emailTemplates.reportSubmitted(userName, postTitle, reason, additionalInfo, reportId, monthlyReportCount, totalReportCount);

    return await emailService.sendNotification(userEmail, subject, message, htmlContent);
  },

  // REPORT STATUS UPDATE EMAIL
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

  // ADMIN REPORT NOTIFICATION WITH MONTHLY COUNTS
  sendAdminReportNotification: async (adminEmail, adminName, postTitle, reason, additionalInfo = '', reportId, reporterName, monthlyReportCount = 0, totalReportCount = 0) => {
    const subject = 'New Report Submitted - Action Required';
    const message = `Hello ${adminName},\n\nA new report has been submitted for the post "${postTitle}".\n\nReport Details:\n- Post: "${postTitle}"\n- Reason: ${reason}\n${additionalInfo ? `- Additional Info: ${additionalInfo}\n` : ''}- Reporter: ${reporterName}\n- Report ID: #${reportId}\n- Monthly Reports: ${monthlyReportCount}\n- Total Reports: ${totalReportCount}\n\nPlease review this report in the admin panel.\n\nBest regards,\nThe Community Platform`;
    
    const htmlContent = emailTemplates.adminReportNotification(adminName, postTitle, reason, additionalInfo, reportId, reporterName, monthlyReportCount, totalReportCount);

    return await emailService.sendNotification(adminEmail, subject, message, htmlContent);
  },

  // FEEDBACK NOTIFICATION TO ADMINS
  sendFeedbackNotification: async (adminEmail, adminName, type, title, description, priority, submittedBy) => {
    const subject = `New ${type} Feedback: ${title}`;
    const message = `Hello ${adminName},\n\nA new ${type} feedback has been submitted.\n\nFeedback Details:\n- Type: ${type}\n- Priority: ${priority}\n- Submitted by: ${submittedBy}\n- Title: ${title}\n- Description: ${description}\n\nPlease review this feedback in the admin panel.\n\nBest regards,\nThe Community Platform`;
    
    const htmlContent = emailTemplates.feedbackNotification(adminName, type, title, description, priority, submittedBy);

    return await emailService.sendNotification(adminEmail, subject, message, htmlContent);
  },

  // FEEDBACK STATUS UPDATE TO USERS
  sendFeedbackStatusUpdate: async (userEmail, userName, title, status, adminNotes) => {
    const subject = `Feedback Update: ${title}`;
    const message = `Hello ${userName},\n\nYour feedback "${title}" has been updated to: ${status}\n${adminNotes ? `\nAdmin Notes: ${adminNotes}\n` : ''}\nThank you for your contribution to improving our platform!\n\nBest regards,\nThe Community Platform Team`;
    
    const htmlContent = emailTemplates.feedbackStatusUpdate(userName, title, status, adminNotes);

    return await emailService.sendNotification(userEmail, subject, message, htmlContent);
  },

  // POST ACTION WARNING EMAIL
  sendPostActionWarning: async (userEmail, userName, action, postTitle, reason, currentReports, requiredReports, isSerious = false) => {
    const actions = {
      removed: 'removed from public view',
      deleted: 'permanently deleted'
    };

    const subject = isSerious 
      ? `URGENT: Post ${actions[action]} - Policy Violation Warning` 
      : `Post ${actions[action]} - Community Guidelines Warning`;

    const message = isSerious
      ? `Hello ${userName},\n\nIMPORTANT: Your post "${postTitle}" has been ${actions[action]} by the administrator due to a serious policy violation.\n\nDetails:\n- Current Monthly Reports: ${currentReports}/${requiredReports} (Below threshold)\n- Action: ${actions[action]}\n${reason ? `- Reason: ${reason}\n` : ''}\nThis is a serious violation of our community guidelines. Repeated violations may result in account suspension.\n\nPlease review our community guidelines carefully.\n\nBest regards,\nThe Admin Team`
      : `Hello ${userName},\n\nYour post "${postTitle}" has been ${actions[action]} by the administrator.\n\nNote: This action was taken despite having only ${currentReports} report(s) this month, which is below our normal threshold of ${requiredReports} monthly reports.\n${reason ? `- Reason: ${reason}\n` : ''}\nPlease review our community guidelines to ensure your posts comply with our standards.\n\nBest regards,\nThe Admin Team`;
    
    const htmlContent = emailTemplates.postActionWarning(userName, postTitle, action, reason, currentReports, requiredReports, isSerious);

    return await emailService.sendNotification(userEmail, subject, message, htmlContent);
  },

  // CONTACT FORM NOTIFICATION
  sendContactFormNotification: async (adminEmail, formData) => {
    const { name, email, subject, message, category } = formData;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 20px; border-radius: 8px;">
          <h1 style="margin: 0;">New Contact Form Submission</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h3 style="color: #333; margin-top: 0;">Contact Details</h3>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; width: 120px;">Name:</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Email:</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">
                <a href="mailto:${email}" style="color: #FF8904;">${email}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Category:</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; text-transform: capitalize;">${category}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Subject:</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${subject}</td>
            </tr>
          </table>
        </div>

        <div style="margin-top: 20px;">
          <h3 style="color: #333;">Message</h3>
          <div style="background: white; border: 1px solid #e5e5e5; padding: 15px; border-radius: 6px;">
            <p style="margin: 0; line-height: 1.6; white-space: pre-wrap;">${message}</p>
          </div>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
          <p>This message was sent from the contact form on your website.</p>
        </div>
      </div>
    `;

    const plainMessage = `New contact form submission from ${name} (${email}).\nCategory: ${category}\nSubject: ${subject}\nMessage: ${message}`;

    return await emailService.sendNotification(adminEmail, `New Contact Form: ${subject}`, plainMessage, htmlContent);
  },

  // GENERIC USER WARNING EMAIL (NO REPORT COUNTS)
  sendUserWarning: async (userEmail, userName) => {
    const subject = '⚠️ Community Guidelines Warning';
    const message = `Hello ${userName},\n\nYour account has recently received reports for content that may violate our community guidelines.\n\nPlease review our community guidelines to ensure your posts comply with our standards. Continued violations may result in account suspension.\n\nBest regards,\nThe Admin Team`;
    
    const htmlContent = emailTemplates.userWarning(userName);

    return await emailService.sendNotification(userEmail, subject, message, htmlContent);
  },

  // REPORT DELETED EMAIL FUNCTION
  sendReportDeletedEmail: async (reporterEmail, reporterName, postTitle, reason, reportId) => {
    const subject = 'Report Deleted - Community Platform';
    const message = `Hello ${reporterName},\n\nYour report has been deleted by an administrator.\n\nReport Details:\n- Post: "${postTitle}"\n- Reason: ${reason}\n- Report ID: #${reportId}\n\nIf you believe this was done in error, please contact our support team.\n\nBest regards,\nThe Admin Team`;
    
    const htmlContent = emailTemplates.reportDeleted(reporterName, postTitle, reason, reportId);

    return await emailService.sendNotification(reporterEmail, subject, message, htmlContent);
  },
};

module.exports = emailService;