const Feedback = require('../models/Feedback');
const Notification = require('../models/Notification');
const emailService = require('../services/emailService');
const db = require('../config/db');

const feedbackController = {
  // Submit feedback (authenticated users only)
  submitFeedback: async (req, res) => {
    try {
      const { type, title, description, priority = 'medium', metadata } = req.body;
      
      // Validate required fields
      if (!type || !title || !description) {
        return res.status(400).json({ 
          success: false,
          error: 'Type, title, and description are required'
        });
      }

      // User must be authenticated
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required to submit feedback'
        });
      }

      // Validate feedback type
      const validTypes = ['bug', 'feature', 'suggestion', 'general'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid feedback type. Must be one of: bug, feature, suggestion, general'
        });
      }

      // Validate priority
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid priority. Must be one of: low, medium, high, critical'
        });
      }

      // Validate title and description length
      const trimmedTitle = title.trim();
      const trimmedDescription = description.trim();
      
      if (trimmedTitle.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Title cannot be empty'
        });
      }

      if (trimmedDescription.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Description cannot be empty'
        });
      }

      if (trimmedTitle.length > 255) {
        return res.status(400).json({
          success: false,
          error: 'Title must be less than 255 characters'
        });
      }

      const userId = req.user.id;

      // Prepare metadata with additional info
      const enhancedMetadata = {
        ...metadata,
        browser: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
        ip_address: req.ip || req.connection.remoteAddress
      };

      const feedbackData = {
        user_id: userId,
        type,
        title: trimmedTitle,
        description: trimmedDescription,
        priority,
        metadata: JSON.stringify(enhancedMetadata),
        status: 'pending'
      };

      const feedbackId = await Feedback.create(feedbackData);

      // Notify admins and user
      await feedbackController._handleFeedbackNotifications(feedbackId, feedbackData, req.user);

      res.status(201).json({
        success: true,
        message: 'Feedback submitted successfully!',
        feedbackId
      });
    } catch (error) {
      console.error('Submit feedback error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error submitting feedback'
      });
    }
  },

  // Get all feedback (admin only)
  getAllFeedback: async (req, res) => {
    try {
      const { status, type, priority } = req.query;
      
      const filters = {};
      if (status) filters.status = status;
      if (type) filters.type = type;
      if (priority) filters.priority = priority;
      // REMOVED: assigned_to filter

      const feedback = await Feedback.getAll(filters);
      
      res.json({
        success: true,
        feedback
      });
    } catch (error) {
      console.error('Get all feedback error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching feedback'
      });
    }
  },

  // Get feedback by ID
  getFeedbackById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const feedback = await Feedback.getById(id);
      
      if (!feedback) {
        return res.status(404).json({
          success: false,
          error: 'Feedback not found'
        });
      }

      res.json({
        success: true,
        feedback
      });
    } catch (error) {
      console.error('Get feedback by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching feedback'
      });
    }
  },

  // Get user's own feedback
  getUserFeedback: async (req, res) => {
    try {
      const userId = req.user.id;
      
      const feedback = await Feedback.getByUserId(userId);
      
      res.json({
        success: true,
        feedback
      });
    } catch (error) {
      console.error('Get user feedback error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching user feedback'
      });
    }
  },

  // Update feedback status with user notifications
  updateFeedbackStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, admin_notes } = req.body;

      // Validate status
      const validStatuses = ['pending', 'reviewed', 'in_progress', 'completed', 'rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be one of: pending, reviewed, in_progress, completed, rejected'
        });
      }

      const feedback = await Feedback.getById(id);
      if (!feedback) {
        return res.status(404).json({
          success: false,
          error: 'Feedback not found'
        });
      }

      const updated = await Feedback.updateStatus(id, status, admin_notes);

      if (updated) {
        await feedbackController._handleStatusUpdateNotifications(id, status, admin_notes, feedback, req.user);

        res.json({
          success: true,
          message: `Feedback status updated to ${status}`,
          feedback: {
            id: parseInt(id),
            status,
            admin_notes,
            updated_at: new Date()
          }
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Feedback not found'
        });
      }
    } catch (error) {
      console.error('Update feedback status error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error updating feedback status'
      });
    }
  },

  // 🆕 REMOVED: Assign feedback to admin functionality

  // Delete feedback (admin only)
  deleteFeedback: async (req, res) => {
    try {
      const { id } = req.params;
      const adminUser = req.user;

      // Get feedback before deletion for notification
      const feedback = await Feedback.getById(id);
      if (!feedback) {
        return res.status(404).json({
          success: false,
          error: 'Feedback not found'
        });
      }

      const deleted = await db('feedback').where('id', id).delete();

      if (deleted) {
        await feedbackController._handleDeletionNotification(id, feedback, adminUser);

        res.json({
          success: true,
          message: 'Feedback deleted successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Feedback not found'
        });
      }
    } catch (error) {
      console.error('Delete feedback error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error deleting feedback'
      });
    }
  },

  // Get feedback statistics (admin only)
  getFeedbackStats: async (req, res) => {
    try {
      const stats = await Feedback.getStats();
      
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Get feedback stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching feedback statistics'
      });
    }
  },

  // Get feedback by status (admin only)
  getFeedbackByStatus: async (req, res) => {
    try {
      const { status } = req.params;
      
      const validStatuses = ['pending', 'reviewed', 'in_progress', 'completed', 'rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status'
        });
      }

      const feedback = await Feedback.getByStatus(status);
      
      res.json({
        success: true,
        feedback
      });
    } catch (error) {
      console.error('Get feedback by status error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching feedback by status'
      });
    }
  },

  // Delete user's own feedback - ALLOW ALL STATUSES
  deleteUserFeedback: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Get feedback first to verify ownership
      const feedback = await Feedback.getById(id);
      
      if (!feedback) {
        return res.status(404).json({
          success: false,
          error: 'Feedback not found'
        });
      }

      // Check if the feedback belongs to the current user
      if (feedback.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'You can only delete your own feedback'
        });
      }

      // REMOVED STATUS RESTRICTION - Users can delete feedback with any status
      const deleted = await db('feedback').where('id', id).where('user_id', userId).delete();

      if (deleted) {
        // Create notification for user
        const currentTime = new Date();
        const userNotificationData = {
          user_id: userId,
          title: 'Feedback Deleted',
          message: `Your feedback "${feedback.title}" has been deleted`,
          type: 'feedback_deleted',
          metadata: JSON.stringify({
            feedback_id: id,
            title: feedback.title,
            type: feedback.type,
            status: feedback.status // Include the status for audit purposes
          }),
          is_read: false,
          created_at: currentTime
        };

        await db('notifications').insert(userNotificationData);

        res.json({
          success: true,
          message: 'Feedback deleted successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Feedback not found'
        });
      }
    } catch (error) {
      console.error('Delete user feedback error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error deleting feedback'
      });
    }
  },

  // 🔒 PRIVATE HELPER METHODS

  // Handle notifications for new feedback
  _handleFeedbackNotifications: async (feedbackId, feedbackData, user) => {
    try {
      const adminUsers = await db('users').where('role', 'admin').select('id', 'email', 'first_name');
      const currentTime = new Date();
      const notificationsToInsert = [];

      // Create notifications for all admins
      for (const admin of adminUsers) {
        const notificationData = {
          user_id: admin.id,
          title: 'New Feedback Submitted',
          message: `New ${feedbackData.type} feedback: "${feedbackData.title}"`,
          type: 'feedback_submitted',
          metadata: JSON.stringify({
            feedback_id: feedbackId,
            type: feedbackData.type,
            priority: feedbackData.priority,
            title: feedbackData.title,
            submitted_by: `${user.first_name} ${user.last_name}`
          }),
          is_read: false,
          created_at: currentTime
        };
        notificationsToInsert.push(notificationData);

        // Send email to admin about new feedback
        await emailService.sendFeedbackNotification(
          admin.email,
          admin.first_name,
          feedbackData.type,
          feedbackData.title,
          feedbackData.description,
          feedbackData.priority,
          `${user.first_name} ${user.last_name}`
        );
      }

      // Insert all admin notifications at once
      if (notificationsToInsert.length > 0) {
        await db('notifications').insert(notificationsToInsert);
      }

      // Create notification for the user who submitted feedback
      await Notification.create({
        user_id: user.id,
        title: 'Feedback Submitted',
        message: `Thank you for your ${feedbackData.type} feedback! We will review it soon.`,
        type: 'feedback_submitted',
        metadata: JSON.stringify({ feedback_id: feedbackId }),
        is_read: false
      });
    } catch (error) {
      console.error('Error handling feedback notifications:', error);
    }
  },

  // 🆕 UPDATED: Handle notifications for status updates - FIXED REJECT NOTIFICATION
  _handleStatusUpdateNotifications: async (feedbackId, status, adminNotes, feedback, adminUser) => {
    try {
      const currentTime = new Date();

      // Create user notification if feedback has a user
      if (feedback.user_id) {
        const { title, message } = feedbackController._getStatusUpdateMessages(status, feedback, adminNotes);
        
        const userNotificationData = {
          user_id: feedback.user_id,
          title,
          message,
          type: 'feedback_updated',
          metadata: JSON.stringify({
            feedback_id: feedbackId,
            status,
            admin_notes: adminNotes,
            title: feedback.title,
            previous_status: feedback.status
          }),
          is_read: false,
          created_at: currentTime
        };

        await db('notifications').insert(userNotificationData);

        // 🆕 FIXED: Send email to user about ALL status updates including reject
        if (feedback.submitter_email) {
          await emailService.sendFeedbackStatusUpdate(
            feedback.submitter_email,
            `${feedback.submitter_first_name} ${feedback.submitter_last_name}`,
            feedback.title,
            status,
            adminNotes
          );
        }
      }

      // Create admin notification
      const adminNotificationData = {
        user_id: adminUser.id,
        title: 'Feedback Status Updated',
        message: `You updated feedback "${feedback.title}" to ${status}`,
        type: 'feedback_updated',
        metadata: JSON.stringify({
          feedback_id: feedbackId,
          previous_status: feedback.status,
          new_status: status,
          title: feedback.title,
          admin_notes: adminNotes,
          target_user_id: feedback.user_id,
          target_user_name: feedback.submitter_first_name ? 
            `${feedback.submitter_first_name} ${feedback.submitter_last_name}` : null
        }),
        is_read: false,
        created_at: currentTime
      };

      await db('notifications').insert(adminNotificationData);
    } catch (error) {
      console.error('Error handling status update notifications:', error);
    }
  },

  // 🆕 UPDATED: Get appropriate messages for status updates - FIXED REJECT MESSAGE
  _getStatusUpdateMessages: (status, feedback, adminNotes) => {
    switch (status) {
      case 'reviewed':
        return {
          title: 'Feedback Reviewed',
          message: `Your feedback "${feedback.title}" has been reviewed by our team.`
        };
      case 'in_progress':
        return {
          title: 'Feedback In Progress',
          message: `We're working on your feedback "${feedback.title}".`
        };
      case 'completed':
        return {
          title: 'Feedback Completed',
          message: `Your feedback "${feedback.title}" has been completed and implemented.`
        };
      case 'rejected':
        return {
          title: 'Feedback Rejected',
          message: `Your feedback "${feedback.title}" has been reviewed but cannot be implemented at this time.${adminNotes ? ` Note: ${adminNotes}` : ''}`
        };
      case 'pending':
        return {
          title: 'Feedback Reopened',
          message: `Your feedback "${feedback.title}" has been reopened for review.`
        };
      default:
        return {
          title: 'Feedback Status Updated',
          message: `Your feedback "${feedback.title}" status has been updated to ${status}.`
        };
    }
  },

  // 🆕 REMOVED: _handleAssignmentNotifications function

  // Handle deletion notification
  _handleDeletionNotification: async (feedbackId, feedback, adminUser) => {
    try {
      const currentTime = new Date();

      const adminNotificationData = {
        user_id: adminUser.id,
        title: 'Feedback Deleted',
        message: `You deleted feedback: "${feedback.title}"`,
        type: 'feedback_deleted',
        metadata: JSON.stringify({
          feedback_id: feedbackId,
          title: feedback.title,
          type: feedback.type,
          priority: feedback.priority,
          status: feedback.status, // Include status for audit
          submitted_by: feedback.submitter_first_name ? 
            `${feedback.submitter_first_name} ${feedback.submitter_last_name}` : null
        }),
        is_read: false,
        created_at: currentTime
      };

      await db('notifications').insert(adminNotificationData);
    } catch (error) {
      console.error('Error handling deletion notification:', error);
    }
  },
  // Update feedback (user can edit their own feedback)
updateFeedback: async (req, res) => {
  try {
    const { id } = req.params;
    const { type, title, description, priority } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!type || !title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Type, title, and description are required'
      });
    }

    // Validate feedback type
    const validTypes = ['bug', 'feature', 'suggestion', 'general'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid feedback type. Must be one of: bug, feature, suggestion, general'
      });
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid priority. Must be one of: low, medium, high, critical'
      });
    }

    // Validate title and description length
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    
    if (trimmedTitle.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Title cannot be empty'
      });
    }

    if (trimmedDescription.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Description cannot be empty'
      });
    }

    if (trimmedTitle.length > 255) {
      return res.status(400).json({
        success: false,
        error: 'Title must be less than 255 characters'
      });
    }

    // Get feedback first to verify ownership
    const feedback = await Feedback.getById(id);
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        error: 'Feedback not found'
      });
    }

    // Check if the feedback belongs to the current user
    if (feedback.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only edit your own feedback'
      });
    }

    // Update feedback
    const updateData = {
      type,
      title: trimmedTitle,
      description: trimmedDescription,
      priority,
      updated_at: new Date()
    };

    const updated = await db('feedback')
      .where('id', id)
      .where('user_id', userId)
      .update(updateData);

    if (updated) {
      // Create notification for user
      const currentTime = new Date();
      const userNotificationData = {
        user_id: userId,
        title: 'Feedback Updated',
        message: `Your feedback "${trimmedTitle}" has been updated successfully`,
        type: 'feedback_updated',
        metadata: JSON.stringify({
          feedback_id: id,
          title: trimmedTitle,
          type: type,
          previous_title: feedback.title
        }),
        is_read: false,
        created_at: currentTime
      };

      await db('notifications').insert(userNotificationData);

      res.json({
        success: true,
        message: 'Feedback updated successfully',
        feedback: {
          id: parseInt(id),
          ...updateData
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Feedback not found'
      });
    }
  } catch (error) {
    console.error('Update feedback error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error updating feedback'
    });
  }
},

};

module.exports = feedbackController; 