// services/emailTemplates.js - UPDATED WITH USER STATUS TEMPLATE
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

  // ADD USER STATUS TEMPLATE
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
        </div>
        
        <p>Hello <strong>${userName}</strong>,</p>
        
        <div style="background-color: white; border-left: 4px solid ${config.color}; padding: 15px; margin: 15px 0;">
          <p style="margin: 0;"><strong>Status:</strong> ${config.verb}</p>
          ${reason ? `<p style="margin: 5px 0 0 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
          ${duration ? `<p style="margin: 5px 0 0 0;"><strong>Duration:</strong> ${duration} day(s)</p>` : ''}
        </div>
        
        <p>If you have any questions or believe this was done in error, please contact our support team.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
          <p>Best regards,<br>The Admin Team</p>
          <p style="margin-top: 10px; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    `;
  }
};

module.exports = emailTemplates;