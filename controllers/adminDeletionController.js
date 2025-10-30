const db = require('../config/db');

const adminDeletionController = {
  // Get all deletion requests
  getDeletionRequests: async (req, res) => {
    try {
      console.log('Fetching deletion requests...');

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

      console.log(`Found ${deletionRequests.length} deletion requests`);

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

      // Add limit reached flag, remaining deletions, and pending requests
      const usersWithStats = users.map(user => {
        const deletionCount = user.deletion_count || 0;
        const limitReached = deletionCount >= 3;
        const remainingDeletions = Math.max(0, 3 - deletionCount);
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

  // Process deletion request (approve or reject)
  processDeletionRequest: async (req, res) => {
    const transaction = await db.transaction();
    
    try {
      const { requestId } = req.params;
      const { action, admin_notes } = req.body; // action: 'approve' or 'reject'
      const adminUser = req.user;

      console.log(`Processing deletion request ${requestId} with action: ${action}`);

      // Get the deletion request
      const deletionRequest = await db('deletion_requests')
        .where('id', requestId)
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

        // Reset user's deletion count for current month
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        const existingRecord = await db('user_post_deletions')
          .where('user_id', deletionRequest.user_id)
          .where('month', currentMonth)
          .where('year', currentYear)
          .first();

        if (existingRecord) {
          await db('user_post_deletions')
            .where('id', existingRecord.id)
            .update({
              deletion_count: 0,
              updated_at: now
            });
        } else {
          await db('user_post_deletions').insert({
            user_id: deletionRequest.user_id,
            month: currentMonth,
            year: currentYear,
            deletion_count: 0,
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
          ? 'Your deletion request has been approved. Your deletion limit has been reset and you can now delete posts again.'
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

      await transaction.commit();

      console.log(`Successfully ${action}ed deletion request ${requestId}`);

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

  // Reset user's monthly deletion count
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

      await transaction.commit();

      console.log(`Successfully reset deletion count for user ${userId}`);

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

  // Grant additional deletions to user
  grantAdditionalDeletions: async (req, res) => {
    const transaction = await db.transaction();
    
    try {
      const { userId } = req.params;
      const { additional_count = 1 } = req.body;
      const adminUser = req.user;

      console.log(`Granting ${additional_count} additional deletions to user ${userId}`);

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
      const newCount = Math.max(0, currentCount - additional_count);

      console.log(`Current count: ${currentCount}, new count: ${newCount}`);

      // Update or create record
      if (existingRecord) {
        await db('user_post_deletions')
          .where('id', existingRecord.id)
          .update({
            deletion_count: newCount,
            updated_at: now
          });
      } else {
        await db('user_post_deletions').insert({
          user_id: userId,
          month: currentMonth,
          year: currentYear,
          deletion_count: newCount,
          created_at: now,
          updated_at: now
        });
      }

      // Create admin notification
      const adminNotification = {
        user_id: adminUser.id,
        title: 'Additional Deletions Granted',
        message: `You granted ${additional_count} additional deletion(s) to ${user.first_name} ${user.last_name} (${user.email})`,
        type: 'deletions_granted',
        metadata: JSON.stringify({
          target_user_id: userId,
          target_user_name: `${user.first_name} ${user.last_name}`,
          target_user_email: user.email,
          additional_count: additional_count,
          previous_count: currentCount,
          new_count: newCount,
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
        message: `Administrator granted you ${additional_count} additional deletion(s). You now have ${3 - newCount} deletion(s) remaining this month.`,
        type: 'additional_deletions_granted',
        metadata: JSON.stringify({
          additional_count: additional_count,
          remaining_deletions: 3 - newCount,
          granted_by_admin: adminUser.id,
          granted_by_admin_name: `${adminUser.first_name} ${adminUser.last_name}`,
          granted_at: now
        }),
        is_read: false,
        created_at: now
      };

      await db('notifications').insert(userNotification);

      await transaction.commit();

      console.log(`Successfully granted ${additional_count} deletions to user ${userId}`);

      res.json({
        success: true,
        message: `Granted ${additional_count} additional deletion(s) to ${user.first_name} ${user.last_name}`,
        user: {
          id: userId,
          deletion_count: newCount,
          limit_reached: newCount >= 3,
          remaining_deletions: 3 - newCount
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