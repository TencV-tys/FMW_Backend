const Feedback = require('../models/Feedback');
const Notification = require('../models/Notification');
const emailService = require('../services/emailService');
const db = require('../config/db');

const feedbackController = {
  // Submit feedback (users and anonymous)
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

      const feedbackData = {
        user_id: req.user?.id || null, // Can be anonymous
        type,
        title: title.trim(),
        description: description.trim(),
        priority,
        metadata: metadata ? JSON.stringify(metadata) : null,
        status: 'pending'
      };

      const feedbackId = await Feedback.create(feedbackData);

      // Get all admin users for notification
      const adminUsers = await db('users').where('role', 'admin').select('id', 'email', 'first_name');
      
      const currentTime = new Date();
      const notificationsToInsert = [];

      // Create notifications for all admins
      for (const admin of adminUsers) {
        const notificationData = {
          user_id: admin.id,
          title: 'New Feedback Submitted',
          message: `New ${type} feedback: "${title}"`,
          type: 'feedback_submitted',
          metadata: JSON.stringify({
            feedback_id: feedbackId,
            type,
            priority,
            title,
            submitted_by: req.user ? `${req.user.first_name} ${req.user.last_name}` : 'Anonymous'
          }),
          is_read: false,
          created_at: currentTime
        };
        notificationsToInsert.push(notificationData);

        // Send email to admin about new feedback
        await emailService.sendFeedbackNotification(
          admin.email,
          admin.first_name,
          type,
          title,
          description,
          priority,
          req.user ? `${req.user.first_name} ${req.user.last_name}` : 'Anonymous User'
        );
      }

      // Insert all admin notifications at once
      if (notificationsToInsert.length > 0) {
        await db('notifications').insert(notificationsToInsert);
      }

      // If user is logged in, create notification for them too
      if (req.user) {
        await Notification.create({
          user_id: req.user.id,
          title: 'Feedback Submitted',
          message: `Thank you for your ${type} feedback! We will review it soon.`,
          type: 'feedback_submitted',
          metadata: JSON.stringify({ feedback_id: feedbackId }),
          is_read: false
        });
      }

      res.status(201).json({
        success: true,
        message: 'Feedback submitted successfully!',
        feedbackId,
        anonymous: !req.user
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
      const { status, type, priority, assigned_to } = req.query;
      
      const filters = {};
      if (status) filters.status = status;
      if (type) filters.type = type;
      if (priority) filters.priority = priority;
      if (assigned_to) filters.assigned_to = assigned_to;

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

  // Update feedback status (admin only)
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
        const currentTime = new Date();
        const adminUser = req.user;

        // Create admin notification
        const adminNotificationData = {
          user_id: adminUser.id,
          title: 'Feedback Status Updated',
          message: `You updated feedback "${feedback.title}" to ${status}`,
          type: 'feedback_updated',
          metadata: JSON.stringify({
            feedback_id: id,
            previous_status: feedback.status,
            new_status: status,
            title: feedback.title,
            admin_notes
          }),
          is_read: false,
          created_at: currentTime
        };

        await db('notifications').insert(adminNotificationData);

        // If feedback was submitted by a user, notify them
        if (feedback.user_id) {
          const userNotificationData = {
            user_id: feedback.user_id,
            title: 'Feedback Status Updated',
            message: `Your feedback "${feedback.title}" has been ${status}${admin_notes ? `. Note: ${admin_notes}` : ''}`,
            type: 'feedback_updated',
            metadata: JSON.stringify({
              feedback_id: id,
              status,
              admin_notes,
              title: feedback.title
            }),
            is_read: false,
            created_at: currentTime
          };

          await db('notifications').insert(userNotificationData);

          // Send email to user about status update
          if (feedback.submitter_email) {
            await emailService.sendFeedbackStatusUpdate(
              feedback.submitter_email,
              `${feedback.submitter_first_name} ${feedback.submitter_last_name}`,
              feedback.title,
              status,
              admin_notes
            );
          }
        }

        res.json({
          success: true,
          message: `Feedback status updated to ${status}`
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

  // Assign feedback to admin (admin only)
  assignFeedback: async (req, res) => {
    try {
      const { id } = req.params;
      const { assigned_to } = req.body;

      const feedback = await Feedback.getById(id);
      if (!feedback) {
        return res.status(404).json({
          success: false,
          error: 'Feedback not found'
        });
      }

      // Check if assigned user exists and is admin
      const assignedAdmin = await db('users')
        .where('id', assigned_to)
        .where('role', 'admin')
        .first();

      if (!assignedAdmin) {
        return res.status(400).json({
          success: false,
          error: 'Assigned user must be an admin'
        });
      }

      const updated = await Feedback.assignToAdmin(id, assigned_to);

      if (updated) {
        const currentTime = new Date();
        const adminUser = req.user;

        // Create notification for assigned admin
        const assignmentNotification = {
          user_id: assigned_to,
          title: 'Feedback Assigned',
          message: `You have been assigned to handle feedback: "${feedback.title}"`,
          type: 'feedback_assigned',
          metadata: JSON.stringify({
            feedback_id: id,
            title: feedback.title,
            type: feedback.type,
            priority: feedback.priority,
            assigned_by: `${adminUser.first_name} ${adminUser.last_name}`
          }),
          is_read: false,
          created_at: currentTime
        };

        await db('notifications').insert(assignmentNotification);

        // Create admin notification for audit
        const adminNotification = {
          user_id: adminUser.id,
          title: 'Feedback Assigned',
          message: `You assigned feedback "${feedback.title}" to ${assignedAdmin.first_name} ${assignedAdmin.last_name}`,
          type: 'feedback_assigned',
          metadata: JSON.stringify({
            feedback_id: id,
            title: feedback.title,
            assigned_to: assigned_to,
            assigned_to_name: `${assignedAdmin.first_name} ${assignedAdmin.last_name}`
          }),
          is_read: false,
          created_at: currentTime
        };

        await db('notifications').insert(adminNotification);

        res.json({
          success: true,
          message: `Feedback assigned to ${assignedAdmin.first_name} ${assignedAdmin.last_name}`
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Feedback not found'
        });
      }
    } catch (error) {
      console.error('Assign feedback error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error assigning feedback'
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
        success: false,
        feedback
      });
    } catch (error) {
      console.error('Get feedback by status error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching feedback by status'
      });
    }
  }
};

module.exports = feedbackController;