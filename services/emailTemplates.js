// services/emailTemplates.js - UPDATED WITH FEEDBACK
const emailTemplates = {
  postAction: (userName, postTitle, action, reason) => {
    const actions = {
      deleted: { verb: 'permanently deleted', color: '#ef4444' },
      removed: { verb: 'removed from public view', color: '#f59e0b' },
      resolved: { verb: 'marked as resolved', color: '#10b981' },
      restored: { verb: 'restored', color: '#3b82f6' }
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #333;">Post Update Notification</h1>
        </div>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
          <h2 style="color: ${actions[action].color}; margin: 0;">Your post has been ${actions[action].verb}</h2>
        </div>
        
        <p>Hello <strong>${userName}</strong>,</p>
        
        <div style="background-color: white; border-left: 4px solid ${actions[action].color}; padding: 15px; margin: 15px 0;">
          <p style="margin: 0;"><strong>Post Title:</strong> ${postTitle}</p>
          <p style="margin: 5px 0 0 0;"><strong>Action:</strong> ${actions[action].verb}</p>
          ${reason ? `<p style="margin: 5px 0 0 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
        </div>
        
        <p>If you have any questions or believe this was done in error, please contact our support team.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
          <p>Best regards,<br>The Admin Team</p>
        </div>
      </div>
    `;
  },

  userStatus: (userName, status, reason = '', duration = '') => {
    const statusConfig = {
      suspended: { verb: 'suspended', color: '#f59e0b', title: 'Account Suspended' },
      banned: { verb: 'permanently banned', color: '#ef4444', title: 'Account Banned' },
      activated: { verb: 'activated', color: '#10b981', title: 'Account Reactivated' },
      deleted: { verb: 'permanently deleted', color: '#dc2626', title: 'Account Deleted' }
    };

    const config = statusConfig[status] || statusConfig.suspended;

 return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #333;">${config.title}</h1>
      </div>
      
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
        <h2 style="color: ${config.color}; margin: 0;">Your account has been ${config.verb}</h2>
        ${status === 'suspended' && duration ? `<p style="margin: 10px 0 0 0; font-size: 1.1em;"><strong>Duration:</strong> ${duration} day(s)</p>` : ''}
      </div>
      
      <p>Hello <strong>${userName}</strong>,</p>
      
      <div style="background-color: white; border-left: 4px solid ${config.color}; padding: 15px; margin: 15px 0;">
        <p style="margin: 0;"><strong>Status:</strong> ${config.verb}</p>
        ${reason ? `<p style="margin: 5px 0 0 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
        ${status === 'suspended' && duration ? `<p style="margin: 5px 0 0 0;"><strong>Suspension Period:</strong> ${duration} day(s)</p>` : ''}
        ${status === 'suspended' ? `<p style="margin: 5px 0 0 0;"><strong>Auto-reactivation:</strong> Your account will be automatically reactivated after the suspension period.</p>` : ''}
      </div>
      
      <p>If you have any questions or believe this was done in error, please contact our support team.</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
        <p>Best regards,<br>The Admin Team</p>
        <p style="margin-top: 10px; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  `;
  },

  passwordReset: (userName, resetLink, expiryTime = '1 hour') => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #333; background: #FF8904; color: white; padding: 20px; border-radius: 8px;">Password Reset Request</h1>
        </div>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
          <h2 style="color: #FF8904; margin: 0;">Reset Your Password</h2>
        </div>
        
        <p>Hello <strong>${userName}</strong>,</p>
        
        <p>You requested to reset your password. Click the button below to create a new password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: #FF8904; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Reset Your Password
          </a>
        </div>
        
        <div style="background-color: white; border-left: 4px solid #FF8904; padding: 15px; margin: 15px 0;">
          <p style="margin: 0;"><strong>Reset Link:</strong></p>
          <p style="margin: 5px 0 0 0; word-break: break-all; color: #6b7280;">${resetLink}</p>
        </div>
        
        <p><strong>Important:</strong> This link will expire in <strong>${expiryTime}</strong>. If you didn't request this reset, please ignore this email.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
          <p>Best regards,<br>The Admin Team</p>
          <p style="margin-top: 10px; font-size: 12px;">For security reasons, this link can only be used once.</p>
        </div>
      </div>
    `;
  },

  // NEW: REPORT SUBMITTED TEMPLATE
  reportSubmitted: (userName, postTitle, reason, additionalInfo = '', reportId) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; background: #10b981; color: white; padding: 20px; border-radius: 8px;">
          <h1 style="margin: 0;">Report Submitted Successfully</h1>
        </div>
        
        <p>Hello <strong>${userName}</strong>,</p>
        
        <p>Your report has been submitted successfully and is now under review by our admin team.</p>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3 style="margin: 0 0 10px 0; color: #333;">Report Details:</h3>
          <p style="margin: 5px 0;"><strong>Post Title:</strong> ${postTitle}</p>
          <p style="margin: 5px 0;"><strong>Reason:</strong> ${reason}</p>
          ${additionalInfo ? `<p style="margin: 5px 0;"><strong>Additional Info:</strong> ${additionalInfo}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Report ID:</strong> #${reportId}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> Under Review</p>
        </div>
        
        <p>We will review your report and take appropriate action. You will be notified of any updates regarding your report.</p>
        
        <p>Thank you for helping us maintain a safe and respectful community environment.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
          <p>Best regards,<br>The Community Platform Team</p>
        </div>
      </div>
    `;
  },

  // NEW: REPORT STATUS UPDATE TEMPLATE
  reportStatusUpdate: (userName, postTitle, status, reason, adminNote = '', reportId) => {
    const statusConfig = {
      pending: { verb: 'reopened and is pending review', color: '#f59e0b' },
      under_review: { verb: 'is now under review', color: '#8b5cf6' },
      resolved: { verb: 'has been resolved', color: '#10b981' },
      dismissed: { verb: 'has been dismissed', color: '#ef4444' }
    };

    const config = statusConfig[status] || statusConfig.pending;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; background: ${config.color}; color: white; padding: 20px; border-radius: 8px;">
          <h1 style="margin: 0;">Report ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}</h1>
        </div>
        
        <p>Hello <strong>${userName}</strong>,</p>
        
        <p>Your report for the post <strong>"${postTitle}"</strong> has been ${config.verb}.</p>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3 style="margin: 0 0 10px 0; color: #333;">Report Summary:</h3>
          <p style="margin: 5px 0;"><strong>Reported Post:</strong> ${postTitle}</p>
          <p style="margin: 5px 0;"><strong>Your Reason:</strong> ${reason}</p>
          <p style="margin: 5px 0;"><strong>Current Status:</strong> 
            <span style="color: ${config.color}; font-weight: bold;">
              ${status.replace('_', ' ').toUpperCase()}
            </span>
          </p>
          ${adminNote ? `<p style="margin: 5px 0;"><strong>Admin Note:</strong> ${adminNote}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Report ID:</strong> #${reportId}</p>
        </div>
        
        <p>Thank you for helping us maintain a safe and respectful community environment.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
          <p>Best regards,<br>The Community Platform Team</p>
        </div>
      </div>
    `;
  },

  // NEW: ADMIN REPORT NOTIFICATION TEMPLATE
  adminReportNotification: (adminName, postTitle, reason, additionalInfo = '', reportId, reporterName) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; background: #FF8904; color: white; padding: 20px; border-radius: 8px;">
          <h1 style="margin: 0;">New Report Submitted</h1>
        </div>
        
        <p>Hello <strong>${adminName}</strong>,</p>
        
        <p>A new report has been submitted that requires your attention.</p>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3 style="margin: 0 0 10px 0; color: #333;">Report Details:</h3>
          <p style="margin: 5px 0;"><strong>Post Title:</strong> ${postTitle}</p>
          <p style="margin: 5px 0;"><strong>Reason:</strong> ${reason}</p>
          ${additionalInfo ? `<p style="margin: 5px 0;"><strong>Additional Info:</strong> ${additionalInfo}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Reporter:</strong> ${reporterName}</p>
          <p style="margin: 5px 0;"><strong>Report ID:</strong> #${reportId}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> Pending Review</p>
        </div>
        
        <p>Please review this report in the admin panel and take appropriate action.</p>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="http://localhost:5173/admin/reports" style="background: #FF8904; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Review Report
          </a>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
          <p>Best regards,<br>The Community Platform</p>
        </div>
      </div>
    `;
  },

  // 🆕 FEEDBACK NOTIFICATION TEMPLATE
  feedbackNotification: (adminName, type, title, description, priority, submittedBy) => {
    const typeColors = {
      bug: '#ef4444',
      feature: '#10b981',
      suggestion: '#8b5cf6',
      general: '#FF8904'
    };

    const priorityColors = {
      critical: '#ef4444',
      high: '#f59e0b',
      medium: '#eab308',
      low: '#10b981'
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; background: ${typeColors[type] || '#FF8904'}; color: white; padding: 20px; border-radius: 8px;">
          <h1 style="margin: 0;">New ${type.charAt(0).toUpperCase() + type.slice(1)} Feedback</h1>
        </div>
        
        <p>Hello <strong>${adminName}</strong>,</p>
        
        <p>A new feedback has been submitted that requires your attention.</p>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3 style="margin: 0 0 10px 0; color: #333;">Feedback Details:</h3>
          <p style="margin: 5px 0;"><strong>Type:</strong> 
            <span style="color: ${typeColors[type] || '#FF8904'}; font-weight: bold; text-transform: capitalize;">
              ${type}
            </span>
          </p>
          <p style="margin: 5px 0;"><strong>Priority:</strong> 
            <span style="color: ${priorityColors[priority] || '#6b7280'}; font-weight: bold; text-transform: capitalize;">
              ${priority}
            </span>
          </p>
          <p style="margin: 5px 0;"><strong>Submitted by:</strong> ${submittedBy}</p>
          <p style="margin: 5px 0;"><strong>Title:</strong> ${title}</p>
          <p style="margin: 5px 0;"><strong>Description:</strong> ${description}</p>
        </div>
        
        <p>Please review this feedback in the admin panel and take appropriate action.</p>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="http://localhost:5173/admin/feedback" style="background: #FF8904; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Review Feedback
          </a>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
          <p>Best regards,<br>The Community Platform</p>
        </div>
      </div>
    `;
  },

  // 🆕 FEEDBACK STATUS UPDATE TEMPLATE
  feedbackStatusUpdate: (userName, title, status, adminNotes) => {
    const statusColors = {
      pending: '#f59e0b',
      reviewed: '#8b5cf6',
      in_progress: '#3b82f6',
      completed: '#10b981',
      rejected: '#ef4444'
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; background: ${statusColors[status] || '#FF8904'}; color: white; padding: 20px; border-radius: 8px;">
          <h1 style="margin: 0;">Feedback Status Updated</h1>
        </div>
        
        <p>Hello <strong>${userName}</strong>,</p>
        
        <p>Your feedback has been updated. Here are the details:</p>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3 style="margin: 0 0 10px 0; color: #333;">Feedback Summary:</h3>
          <p style="margin: 5px 0;"><strong>Title:</strong> ${title}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> 
            <span style="color: ${statusColors[status] || '#FF8904'}; font-weight: bold; text-transform: capitalize;">
              ${status.replace('_', ' ')}
            </span>
          </p>
          ${adminNotes ? `<p style="margin: 5px 0;"><strong>Admin Notes:</strong> ${adminNotes}</p>` : ''}
        </div>
        
        <p>Thank you for helping us improve our platform!</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
          <p>Best regards,<br>The Community Platform Team</p>
        </div>
      </div>
    `;
  },
  // 🆕 POST ACTION WARNING TEMPLATE
  postActionWarning: (userName, postTitle, action, reason, currentReports, requiredReports, isSerious = false) => {
    const actions = {
      removed: { verb: 'removed from public view', color: '#f59e0b' },
      deleted: { verb: 'permanently deleted', color: '#ef4444' }
    };

    const config = actions[action] || actions.removed;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; background: ${isSerious ? '#ef4444' : '#f59e0b'}; color: white; padding: 20px; border-radius: 8px;">
          <h1 style="margin: 0;">${isSerious ? '⚠️ SERIOUS POLICY VIOLATION' : 'Community Guidelines Notice'}</h1>
          <p style="margin: 10px 0 0 0; font-size: 1.1em;">Your post has been ${config.verb}</p>
        </div>
        
        <p>Hello <strong>${userName}</strong>,</p>
        
        ${isSerious ? `
          <div style="background-color: #fef2f2; border: 2px solid #fecaca; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <h3 style="color: #dc2626; margin: 0 0 10px 0;">⚠️ Important Notice</h3>
            <p style="margin: 0; color: #dc2626; font-weight: 500;">
              This action was taken due to a serious violation of our community guidelines. 
              Repeated violations may result in account suspension or permanent banning.
            </p>
          </div> 
        ` : `
          <div style="background-color: #fffbeb; border: 2px solid #fef3c7; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <h3 style="color: #d97706; margin: 0 0 10px 0;">ℹ️ Notice</h3>
            <p style="margin: 0; color: #d97706;">
              This action was taken despite having reports below our normal threshold, 
              indicating a potential violation of community standards.
            </p>
          </div>
        `}
        
        <div style="background-color: white; border-left: 4px solid ${config.color}; padding: 15px; margin: 15px 0;">
          <p style="margin: 0;"><strong>Post Title:</strong> ${postTitle}</p>
          <p style="margin: 5px 0 0 0;"><strong>Action:</strong> ${config.verb}</p>
          <p style="margin: 5px 0 0 0;"><strong>Current Reports:</strong> ${currentReports}/${requiredReports} (Below threshold)</p>
          ${reason ? `<p style="margin: 5px 0 0 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
        </div>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #374151;">Recommended Actions:</h4>
          <ul style="margin: 0; padding-left: 20px;">
            <li>Review our community guidelines</li>
            <li>Ensure future posts comply with our standards</li>
            <li>Contact support if you have questions</li>
          </ul>
        </div>
        
        <p>If you believe this was done in error, please contact our support team for review.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
          <p>Best regards,<br>The Admin Team</p>
          <p style="margin-top: 10px; font-size: 12px;">
            This is an automated warning message. Please do not reply to this email.
          </p>
        </div>
      </div>
    `;
  },
// User warning template
userWarning: (userName, monthlyReports, totalReports) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 20px; background: #f59e0b; color: white; padding: 20px; border-radius: 8px;">
        <h1 style="margin: 0;">⚠️ Community Guidelines Warning</h1>
      </div>
      
      <p>Hello <strong>${userName}</strong>,</p>
      
      <div style="background-color: #fffbeb; border: 2px solid #fef3c7; padding: 15px; border-radius: 6px; margin: 15px 0;">
        <h3 style="color: #d97706; margin: 0 0 10px 0;">Important Notice</h3>
        <p style="margin: 0; color: #d97706;">
          Your account has received multiple reports that require your attention.
        </p>
      </div>
      
      <div style="background-color: white; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0;">
        <p style="margin: 0;"><strong>Monthly Reports:</strong> ${monthlyReports}</p>
        <p style="margin: 5px 0 0 0;"><strong>Total Reports:</strong> ${totalReports}</p>
      </div>
      
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
        <h4 style="margin: 0 0 10px 0; color: #374151;">Recommended Actions:</h4>
        <ul style="margin: 0; padding-left: 20px;">
          <li>Review our community guidelines</li>
          <li>Ensure your posts comply with our standards</li>
          <li>Contact support if you have questions</li>
        </ul>
      </div>
      
      <p>Continued violations may result in account suspension or permanent banning.</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
        <p>Best regards,<br>The Admin Team</p>
      </div>
    </div>
  `;
},
// Add this to your emailTemplates.js
reportDeleted: (userName, postTitle, reason, reportId) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px;">Report Deleted</h1>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
          Hello <strong>${userName}</strong>,
        </p>
        
        <p style="font-size: 16px; color: #666; margin-bottom: 20px;">
          Your report has been deleted by an administrator.
        </p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Report Details</h3>
          <table style="width: 100%;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 120px;"><strong>Report ID:</strong></td>
              <td style="padding: 8px 0; color: #333;">#${reportId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Post Title:</strong></td>
              <td style="padding: 8px 0; color: #333;">"${postTitle}"</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Reason:</strong></td>
              <td style="padding: 8px 0; color: #333;">${reason}</td>
            </tr>
          </table>
        </div>
        
        <p style="font-size: 14px; color: #999; margin-top: 30px;">
          If you believe this was done in error, please contact our support team.
        </p>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
        <p style="margin: 0;">Best regards,<br>The Community Platform Team</p>
      </div>
    </div>
  `;
},

};

module.exports = emailTemplates;