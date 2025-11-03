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

      // Get current deletion counts for each user
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      const requestsWithDeletionCounts = await Promise.all(
        deletionRequests.map(async (request) => {
          const deletionRecord = await db('user_post_deletions')
            .where('user_id', request.user_id)
            .where('month', currentMonth)
            .where('year', currentYear)
            .first();

          const currentDeletions = deletionRecord ? deletionRecord.deletion_count : 0;
          
          return {
            ...request,
            current_deletions: currentDeletions
          };
        })
      );

      res.json({
        success: true,
        requests: requestsWithDeletionCounts
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

      const usersWithStats = users.map(user => {
        const deletionCount = user.deletion_count || 0;
        const MONTHLY_LIMIT = 3;
        
        const limitReached = deletionCount >= MONTHLY_LIMIT;
        const remainingDeletions = Math.max(0, MONTHLY_LIMIT - deletionCount);
        const pendingRequestsCount = pendingRequestsMap[user.id] || 0;

        return {
          ...user,
          deletion_count: deletionCount,
          limit_reached: limitReached,
          remaining_deletions: remainingDeletions,
          pending_requests_count: pendingRequestsCount
        };
      });

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
      const { action, admin_notes } = req.body;
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

        // INCREMENT user's deletion count by 1
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

      // 🆕 CREATE ADMIN NOTIFICATION FOR THE ACTION
      const adminNotification = {
        user_id: adminUser.id, // This goes to admin's notification list
        title: `Deletion Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        message: `You ${action === 'approve' ? 'approved' : 'rejected'} deletion request from ${deletionRequest.first_name} ${deletionRequest.last_name}. ${admin_notes ? `Notes: ${admin_notes}` : ''}`,
        type: `deletion_request_${action}ed`,
        metadata: JSON.stringify({
          request_id: requestId,
          user_id: deletionRequest.user_id,
          user_name: `${deletionRequest.first_name} ${deletionRequest.last_name}`,
          user_email: deletionRequest.email,
          action: action,
          admin_notes: admin_notes,
          processed_by: adminUser.id,
          processed_by_name: `${adminUser.first_name} ${adminUser.last_name}`,
          processed_at: now
        }),
        is_read: false,
        created_at: now
      };

      await db('notifications').insert(adminNotification);

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
  }
};

module.exports = adminDeletionController;