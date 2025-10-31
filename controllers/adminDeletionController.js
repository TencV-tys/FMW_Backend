const db = require('../config/db');
const emailService = require('../services/emailService');

const adminDeletionController = {
  // Get all deletion requests
  getDeletionRequests: async (req, res) => {
    try {
      
      const deletionRequests = await db('deletion_requests')
        .join('users', 'deletion_requests.user_id', 'users.id')
        .leftJoin('posts', 'deletion_requests.post_id', 'posts.id')
        .leftJoin('users as admin_users', 'deletion_requests.processed_by', 'admin_users.id')
        .select(
          'deletion_requests.*',
          'users.first_name',
          'users.last_name',
          'users.email',
          'posts.title as post_title',
          'admin_users.first_name as processed_by_first_name',
          'admin_users.last_name as processed_by_last_name'
        )
        .orderBy('deletion_requests.created_at', 'desc');

     
      res.json({
        success: true,
        requests: deletionRequests
      });
    } catch (error) {
      console.error('Get deletion requests error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching deletion requests: ' + error.message
      });
    }
  },

  // Get all users with their deletion stats AND pending requests
  
getUsersDeletionStats: async (req, res) => {
  try {
    console.log('Fetching users deletion stats with requests...');
    
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Get all users with their deletion counts
    const users = await db('users')
      .leftJoin('user_post_deletions', function() {
        this.on('users.id', '=', 'user_post_deletions.user_id')
          .andOn('user_post_deletions.month', '=', currentMonth)
          .andOn('user_post_deletions.year', '=', currentYear);
      })
      .select(
        'users.id',
        'users.first_name',
        'users.last_name',
        'users.email',
        'users.role',
        'users.status',
        'user_post_deletions.deletion_count',
        'user_post_deletions.month',
        'user_post_deletions.year'
      )
      .where('users.role', 'user')
      .orderBy('user_post_deletions.deletion_count', 'desc');

    // Get pending deletion requests count for each user
    const pendingRequests = await db('deletion_requests')
      .where('status', 'pending')
      .groupBy('user_id')
      .select('user_id', db.raw('COUNT(*) as pending_requests_count'));

    const pendingRequestsMap = {};
    pendingRequests.forEach(req => {
      pendingRequestsMap[req.user_id] = req.pending_requests_count;
    });

    // 🎯 FIXED: Add limit reached flag, remaining deletions, and pending requests
    const usersWithStats = users.map(user => {
      const deletionCount = user.deletion_count || 0; // If no record, count is 0
      const MONTHLY_LIMIT = 3;
      
      // 🎯 FIX: Only mark as limit reached if they've actually reached the limit
      const limitReached = deletionCount >= MONTHLY_LIMIT;
      const remainingDeletions = Math.max(0, MONTHLY_LIMIT - deletionCount);
      const pendingRequestsCount = pendingRequestsMap[user.id] || 0;

      return {
        ...user,
        deletion_count: deletionCount,
        limit_reached: limitReached, // 🎯 This should be false for users with 0-2 deletions
        remaining_deletions: remainingDeletions,
        pending_requests_count: pendingRequestsCount
      };
    });

    console.log('Users with stats:', usersWithStats.map(u => ({
      id: u.id,
      name: `${u.first_name} ${u.last_name}`,
      deletion_count: u.deletion_count,
      limit_reached: u.limit_reached,
      remaining: u.remaining_deletions
    })));

    res.json({
      success: true,
      users: usersWithStats
    });
  } catch (error) {
    console.error('Get users deletion stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching users deletion stats: ' + error.message
    });
  }
},
  // Process deletion request (approve or reject) with email notifications
  processDeletionRequest: async (req, res) => {
    const transaction = await db.transaction();
    
    try {
      const { requestId } = req.params;
      const { action, admin_notes } = req.body; // action: 'approve' or 'reject'
      const adminUser = req.user;

      console.log(`Processing deletion request ${requestId} with action: ${action}`);

      // Get the deletion request with user info
      const deletionRequest = await db('deletion_requests')
        .join('users', 'deletion_requests.user_id', 'users.id')
        .where('deletion_requests.id', requestId)
        .select('deletion_requests.*', 'users.first_name', 'users.last_name', 'users.email')
        .first();

      if (!deletionRequest) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          error: 'Deletion request not found'
        });
      }

      if (deletionRequest.status !== 'pending') {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: 'This request has already been processed'
        });
      }

      const now = new Date();

      if (action === 'approve') {
        // If there's a post_id, delete the post
        if (deletionRequest.post_id) {
          await db('posts')
            .where('id', deletionRequest.post_id)
            .delete();
        }

        // INCREMENT user's deletion count by 1 instead of resetting to 0
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        const existingRecord = await db('user_post_deletions')
          .where('user_id', deletionRequest.user_id)
          .where('month', currentMonth)
          .where('year', currentYear)
          .first();

        const newDeletionCount = existingRecord ? existingRecord.deletion_count + 1 : 1;

        if (existingRecord) {
          await db('user_post_deletions')
            .where('id', existingRecord.id)
            .update({
              deletion_count: newDeletionCount,
              updated_at: now
            });
        } else {
          await db('user_post_deletions').insert({
            user_id: deletionRequest.user_id,
            month: currentMonth,
            year: currentYear,
            deletion_count: newDeletionCount,
            created_at: now,
            updated_at: now
          });
        }

   }

      // Update the deletion request
      await db('deletion_requests')
        .where('id', requestId)
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          admin_notes: admin_notes || null,
          processed_by: adminUser.id,
          processed_at: now,
          updated_at: now
        });

      // Create user notification
      const userNotification = {
        user_id: deletionRequest.user_id,
        title: `Deletion Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        message: action === 'approve' 
          ? 'Your deletion request has been approved. The post has been deleted and this counts toward your monthly deletion limit.'
          : `Your deletion request has been rejected. ${admin_notes ? 'Reason: ' + admin_notes : ''}`,
        type: `deletion_request_${action}ed`,
        metadata: JSON.stringify({
          request_id: requestId,
          action: action,
          admin_notes: admin_notes,
          processed_by: adminUser.id,
          processed_by_name: `${adminUser.first_name} ${adminUser.last_name}`,
          processed_at: now
        }),
        is_read: false,
        created_at: now
      };

      await db('notifications').insert(userNotification);

      // ✅ SEND EMAIL NOTIFICATION TO USER
      const emailSubject = action === 'approve' 
        ? 'Deletion Request Approved' 
        : 'Deletion Request Rejected';
      
      const emailMessage = action === 'approve'
        ? `Hello ${deletionRequest.first_name},\n\nYour deletion request (ID: #${requestId}) has been approved.\n\nThe requested post has been deleted and this action counts toward your monthly deletion limit.\n\nThank you for using our platform.`
        : `Hello ${deletionRequest.first_name},\n\nYour deletion request (ID: #${requestId}) has been rejected.\n\n${admin_notes ? `Reason: ${admin_notes}\n\n` : ''}If you have any questions, please contact our support team.\n\nThank you for your understanding.`;

      const emailHtml = action === 'approve'
        ? `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px; background: #10b981; color: white; padding: 20px; border-radius: 8px;">
              <h1 style="margin: 0;">Deletion Request Approved</h1>
            </div>
            
            <p>Hello <strong>${deletionRequest.first_name}</strong>,</p>
            
            <p>Your deletion request has been approved by the administrator.</p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <h3 style="margin: 0 0 10px 0; color: #333;">Request Details:</h3>
              <p style="margin: 5px 0;"><strong>Request ID:</strong> #${requestId}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> Approved</p>
              <p style="margin: 5px 0;"><strong>Processed:</strong> ${now.toLocaleString()}</p>
              <p style="margin: 5px 0;"><strong>Note:</strong> This deletion counts toward your monthly limit</p>
            </div>
            
            <p>The requested post has been deleted successfully.</p>
            
            <p>Thank you for using our platform!</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
              <p>Best regards,<br>The Community Platform Team</p>
            </div>
          </div>
        `
        : `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px; background: #ef4444; color: white; padding: 20px; border-radius: 8px;">
              <h1 style="margin: 0;">Deletion Request Rejected</h1>
            </div>
            
            <p>Hello <strong>${deletionRequest.first_name}</strong>,</p>
            
            <p>Your deletion request has been reviewed and unfortunately could not be approved at this time.</p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <h3 style="margin: 0 0 10px 0; color: #333;">Request Details:</h3>
              <p style="margin: 5px 0;"><strong>Request ID:</strong> #${requestId}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> Rejected</p>
              <p style="margin: 5px 0;"><strong>Processed:</strong> ${now.toLocaleString()}</p>
              ${admin_notes ? `<p style="margin: 5px 0;"><strong>Admin Note:</strong> ${admin_notes}</p>` : ''}
            </div>
            
            <p>If you have any questions or believe this was done in error, please contact our support team.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
              <p>Best regards,<br>The Community Platform Team</p>
            </div>
          </div>
        `;

      await emailService.sendNotification(
        deletionRequest.email,
        emailSubject,
        emailMessage,
        emailHtml
      );

      await transaction.commit();

      res.json({
        success: true,
        message: `Deletion request ${action}ed successfully`
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Process deletion request error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error processing deletion request: ' + error.message
      });
    }
  },

  // Reset user's monthly deletion count with email notifications
  resetUserDeletionCount: async (req, res) => {
    const transaction = await db.transaction();
    
    try {
      const { userId } = req.params;
      const adminUser = req.user;

      console.log(`Resetting deletion count for user ${userId}`);

      // Get current month and year
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // Check if user exists
      const user = await db('users')
        .where('id', userId)
        .select('id', 'first_name', 'last_name', 'email')
        .first();

      if (!user) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Check if record exists for this month
      const existingRecord = await db('user_post_deletions')
        .where('user_id', userId)
        .where('month', currentMonth)
        .where('year', currentYear)
        .first();

      if (existingRecord) {
        // Update existing record
        await db('user_post_deletions')
          .where('id', existingRecord.id)
          .update({
            deletion_count: 0,
            updated_at: now
          });
      } else {
        // Create new record
        await db('user_post_deletions').insert({
          user_id: userId,
          month: currentMonth,
          year: currentYear,
          deletion_count: 0,
          created_at: now,
          updated_at: now
        });
      }

      // Create admin notification
      const adminNotification = {
        user_id: adminUser.id,
        title: 'Deletion Count Reset',
        message: `You reset deletion count for user ${user.first_name} ${user.last_name} (${user.email})`,
        type: 'deletion_reset',
        metadata: JSON.stringify({
          target_user_id: userId,
          target_user_name: `${user.first_name} ${user.last_name}`,
          target_user_email: user.email,
          performed_by: adminUser.id,
          performed_by_name: `${adminUser.first_name} ${adminUser.last_name}`,
          reset_at: now
        }),
        is_read: false,
        created_at: now
      };

      await db('notifications').insert(adminNotification);

      // Create user notification
      const userNotification = {
        user_id: userId,
        title: 'Deletion Limit Reset',
        message: 'Your monthly deletion limit has been reset by administrator. You can now delete posts again.',
        type: 'deletion_limit_reset',
        metadata: JSON.stringify({
          reset_by_admin: adminUser.id,
          reset_by_admin_name: `${adminUser.first_name} ${adminUser.last_name}`,
          reset_at: now
        }),
        is_read: false,
        created_at: now
      };

      await db('notifications').insert(userNotification);

      // ✅ SEND EMAIL NOTIFICATION TO USER
      await emailService.sendNotification(
        user.email,
        'Deletion Limit Reset - Community Platform',
        `Hello ${user.first_name},\n\nYour monthly deletion limit has been reset by an administrator.\n\nYou now have 3 deletions available for the current month.\n\nYou can delete posts again as needed.\n\nBest regards,\nThe Community Platform Team`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px; background: #10b981; color: white; padding: 20px; border-radius: 8px;">
              <h1 style="margin: 0;">Deletion Limit Reset</h1>
            </div>
            
            <p>Hello <strong>${user.first_name}</strong>,</p>
            
            <p>Your monthly deletion limit has been reset by an administrator.</p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <h3 style="margin: 0 0 10px 0; color: #333;">New Limits:</h3>
              <p style="margin: 5px 0;"><strong>Available Deletions:</strong> 3</p>
              <p style="margin: 5px 0;"><strong>Reset by:</strong> Administrator</p>
              <p style="margin: 5px 0;"><strong>Reset at:</strong> ${now.toLocaleString()}</p>
            </div>
            
            <p>You can now delete posts again as needed. This reset applies to the current month only.</p>
            
            <p>Thank you for using our platform!</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
              <p>Best regards,<br>The Community Platform Team</p>
            </div>
          </div>
        `
      );

      await transaction.commit();

      res.json({
        success: true,
        message: `Deletion count reset successfully for ${user.first_name} ${user.last_name}`,
        user: {
          id: userId,
          deletion_count: 0,
          limit_reached: false,
          remaining_deletions: 3
        }
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Reset user deletion count error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error resetting deletion count: ' + error.message
      });
    }
  },

  // Grant additional deletions to user with email notifications
  grantAdditionalDeletions: async (req, res) => {
    const transaction = await db.transaction();
    
    try {
      const { userId } = req.params;
      const { additional_count = 1 } = req.body;
      const adminUser = req.user;

    
      // Get current month and year
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // Check if user exists
      const user = await db('users')
        .where('id', userId)
        .select('id', 'first_name', 'last_name', 'email')
        .first();

      if (!user) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Get current deletion count
      const existingRecord = await db('user_post_deletions')
        .where('user_id', userId)
        .where('month', currentMonth)
        .where('year', currentYear)
        .first();

      const currentCount = existingRecord ? existingRecord.deletion_count : 0;
      
      // FIX: Ensure we don't go below 0, but also handle the case where user is over limit
      const newCount = Math.max(0, currentCount - additional_count);
      
      // If user was over limit (currentCount > 3), we want to bring them back to at most 2
      // so they have at least 1 deletion remaining
      const effectiveNewCount = currentCount > 3 ? Math.min(2, newCount) : newCount;

    
      // Update or create record
      if (existingRecord) {
        await db('user_post_deletions')
          .where('id', existingRecord.id)
          .update({
            deletion_count: effectiveNewCount,
            updated_at: now
          });
      } else {
        await db('user_post_deletions').insert({
          user_id: userId,
          month: currentMonth,
          year: currentYear,
          deletion_count: effectiveNewCount,
          created_at: now,
          updated_at: now
        });
      }

      const remainingDeletions = 3 - effectiveNewCount;

      // Create admin notification
      const adminNotification = {
        user_id: adminUser.id,
        title: 'Additional Deletions Granted',
        message: `You granted ${additional_count} additional deletion(s) to ${user.first_name} ${user.last_name} (${user.email}). They now have ${remainingDeletions} deletion(s) remaining.`,
        type: 'deletions_granted',
        metadata: JSON.stringify({
          target_user_id: userId,
          target_user_name: `${user.first_name} ${user.last_name}`,
          target_user_email: user.email,
          additional_count: additional_count,
          previous_count: currentCount,
          new_count: effectiveNewCount,
          remaining_deletions: remainingDeletions,
          performed_by: adminUser.id,
          performed_by_name: `${adminUser.first_name} ${adminUser.last_name}`,
          granted_at: now
        }),
        is_read: false,
        created_at: now
      };

      await db('notifications').insert(adminNotification);

      // Create user notification
      const userNotification = {
        user_id: userId,
        title: 'Additional Deletions Granted',
        message: `Administrator granted you ${additional_count} additional deletion(s). You now have ${remainingDeletions} deletion(s) remaining this month.`,
        type: 'additional_deletions_granted',
        metadata: JSON.stringify({
          additional_count: additional_count,
          remaining_deletions: remainingDeletions,
          granted_by_admin: adminUser.id,
          granted_by_admin_name: `${adminUser.first_name} ${adminUser.last_name}`,
          granted_at: now
        }),
        is_read: false,
        created_at: now
      };

      await db('notifications').insert(userNotification);

      // ✅ SEND EMAIL NOTIFICATION TO USER
      await emailService.sendNotification(
        user.email,
        'Additional Deletions Granted - Community Platform',
        `Hello ${user.first_name},\n\nAn administrator has granted you ${additional_count} additional deletion(s).\n\nYour new deletion status:\n- Previous deletions used: ${currentCount}/3\n- New deletions used: ${effectiveNewCount}/3\n- Remaining deletions: ${remainingDeletions}/3\n\nYou can now delete more posts this month as needed.\n\nBest regards,\nThe Community Platform Team`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px; background: #3b82f6; color: white; padding: 20px; border-radius: 8px;">
              <h1 style="margin: 0;">Additional Deletions Granted</h1>
            </div>
            
            <p>Hello <strong>${user.first_name}</strong>,</p>
            
            <p>An administrator has granted you additional deletion capacity for this month.</p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <h3 style="margin: 0 0 10px 0; color: #333;">Your New Deletion Status:</h3>
              <p style="margin: 5px 0;"><strong>Additional Deletions Granted:</strong> ${additional_count}</p>
              <p style="margin: 5px 0;"><strong>Previous Count:</strong> ${currentCount}/3 used</p>
              <p style="margin: 5px 0;"><strong>New Count:</strong> ${effectiveNewCount}/3 used</p>
              <p style="margin: 5px 0;"><strong>Remaining Deletions:</strong> ${remainingDeletions}/3 available</p>
              <p style="margin: 5px 0;"><strong>Granted by:</strong> Administrator</p>
              <p style="margin: 5px 0;"><strong>Granted at:</strong> ${now.toLocaleString()}</p>
            </div>
            
            <p>You can now delete more posts this month as needed. This applies to the current month only.</p>
            
            <p>Thank you for using our platform!</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #6b7280;">
              <p>Best regards,<br>The Community Platform Team</p>
            </div>
          </div>
        `
      );

      await transaction.commit();

     
      res.json({
        success: true,
        message: `Granted ${additional_count} additional deletion(s) to ${user.first_name} ${user.last_name}. They now have ${remainingDeletions} deletion(s) remaining.`,
        user: {
          id: userId,
          deletion_count: effectiveNewCount,
          limit_reached: effectiveNewCount >= 3,
          remaining_deletions: remainingDeletions
        }
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Grant additional deletions error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error granting additional deletions: ' + error.message
      });
    }
  }
};

module.exports = adminDeletionController;