const emailTemplates = {
  postAction: (userName, postTitle, action, reason) => {
    const actions = {
      deleted: { verb: 'permanently deleted', color: '#dc2626' }, // Red for delete
      removed: { verb: 'removed from public view', color: '#f59e0b' }, // Orange for remove
      resolved: { verb: 'marked as resolved', color: '#10b981' }, // Green for resolved
      restored: { verb: 'restored', color: '#FF8904' } // Your brown/orange for restore
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 20px; border-radius: 8px;">
          <h1 style="margin: 0;">Post Update Notification</h1>
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
      banned: { verb: 'permanently banned', color: '#dc2626', title: 'Account Banned' },
      activated: { verb: 'activated', color: '#10b981', title: 'Account Reactivated' },
      deleted: { verb: 'permanently deleted', color: '#dc2626', title: 'Account Deleted' },
      restored: { verb: 'restored', color: '#FF8904', title: 'Account Restored' }
    };

    const config = statusConfig[status] || statusConfig.suspended;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 20px; border-radius: 8px;">
          <h1 style="margin: 0;">${config.title}</h1>
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
        <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 20px; border-radius: 8px;">
          <h1 style="margin: 0;">Password Reset Request</h1>
        </div>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
          <h2 style="color: #FF8904; margin: 0;">Reset Your Password</h2>
        </div>
        
        <p>Hello <strong>${userName}</strong>,</p>
        
        <p>You requested to reset your password. Click the button below to create a new password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
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

  reportSubmitted: (userName, postTitle, reason, additionalInfo = '', reportId) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 20px; border-radius: 8px;">
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

  reportStatusUpdate: (userName, postTitle, status, reason, adminNote = '', reportId) => {
    const statusConfig = {
      pending: { verb: 'reopened and is pending review', color: '#f59e0b' },
      under_review: { verb: 'is now under review', color: '#FF8904' }, // Using your brown/orange
      resolved: { verb: 'has been resolved', color: '#10b981' },
      dismissed: { verb: 'has been dismissed', color: '#dc2626' }
    };

    const config = statusConfig[status] || statusConfig.pending;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 20px; border-radius: 8px;">
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

  adminReportNotification: (adminName, postTitle, reason, additionalInfo = '', reportId, reporterName) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 20px; border-radius: 8px;">
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
          <a href="http://localhost:5173/admin/reports" style="background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Review Report
          </a>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
          <p>Best regards,<br>The Community Platform</p>
        </div>
      </div>
    `;
  },

  feedbackNotification: (adminName, type, title, description, priority, submittedBy) => {
    const typeColors = {
      bug: '#dc2626',
      feature: '#10b981',
      suggestion: '#FF8904', // Using your brown/orange
      general: '#FF8904'     // Using your brown/orange
    };

    const priorityColors = {
      critical: '#dc2626',
      high: '#f59e0b',
      medium: '#FF8904', // Using your brown/orange
      low: '#10b981'
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 20px; border-radius: 8px;">
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
            <span style="color: ${priorityColors[priority] || '#FF8904'}; font-weight: bold; text-transform: capitalize;">
              ${priority}
            </span>
          </p>
          <p style="margin: 5px 0;"><strong>Submitted by:</strong> ${submittedBy}</p>
          <p style="margin: 5px 0;"><strong>Title:</strong> ${title}</p>
          <p style="margin: 5px 0;"><strong>Description:</strong> ${description}</p>
        </div>
        
        <p>Please review this feedback in the admin panel and take appropriate action.</p>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="http://localhost:5173/admin/feedback" style="background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Review Feedback
          </a>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
          <p>Best regards,<br>The Community Platform</p>
        </div>
      </div>
    `;
  },

  feedbackStatusUpdate: (userName, title, status, adminNotes) => {
    const statusColors = {
      pending: '#f59e0b',
      reviewed: '#FF8904', // Using your brown/orange
      in_progress: '#FF8904', // Using your brown/orange
      completed: '#10b981',
      rejected: '#dc2626'
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 20px; border-radius: 8px;">
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

  postActionWarning: (userName, postTitle, action, reason, currentReports, requiredReports, isSerious = false) => {
    const actions = {
      removed: { verb: 'removed from public view', color: '#f59e0b' },
      deleted: { verb: 'permanently deleted', color: '#dc2626' }
    };

    const config = actions[action] || actions.removed;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 20px; border-radius: 8px;">
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

  userWarning: (userName) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 20px; border-radius: 8px;">
          <h1 style="margin: 0;">⚠️ Community Guidelines Warning</h1>
        </div>
        
        <p>Hello <strong>${userName}</strong>,</p>
        
        <div style="background-color: #fffbeb; border: 2px solid #fef3c7; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3 style="color: #d97706; margin: 0 0 10px 0;">Important Notice</h3>
          <p style="margin: 0; color: #d97706;">
            Your account has recently received reports for content that may violate our community guidelines.
          </p>
        </div>
        
        <div style="background-color: white; border-left: 4px solid #FF8904; padding: 15px; margin: 15px 0;">
          <p style="margin: 0;"><strong>Action Required:</strong> Please review our community guidelines</p>
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

  reportDeleted: (userName, postTitle, reason, reportId) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #FF8904 0%, #e57c00 100%); color: white; padding: 20px; border-radius: 8px;">
          <h1 style="margin: 0;">Report Deleted</h1>
        </div>
        
        <p>Hello <strong>${userName}</strong>,</p>
        
        <p>Your report has been deleted by an administrator.</p>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3 style="margin: 0 0 10px 0; color: #333;">Report Details:</h3>
          <p style="margin: 5px 0;"><strong>Report ID:</strong> #${reportId}</p>
          <p style="margin: 5px 0;"><strong>Post Title:</strong> "${postTitle}"</p>
          <p style="margin: 5px 0;"><strong>Reason:</strong> ${reason}</p>
        </div>
        
        <p style="font-size: 14px; color: #999; margin-top: 30px;">
          If you believe this was done in error, please contact our support team.
        </p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
          <p>Best regards,<br>The Community Platform Team</p>
        </div>
      </div>
    `;
  }
};

module.exports = emailTemplates;