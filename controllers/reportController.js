// controllers/reportController.js
const Report = require('../models/Report');
const Notification = require('../models/Notification');
const Post = require('../models/Post');
const db = require('../config/db');

const reportController = {
  submitReport: async (req, res) => {
    try {
      const { post_id, reason, additional_info } = req.body;
      const reporter_id = req.user.id;

      if (!post_id || !reason) {
        return res.status(400).json({
          success: false,
          error: 'Post ID and reason are required'
        });
      }

      const post = await Post.getById(post_id);
      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found'
        });
      }

      if (post.user_id === reporter_id) {
        return res.status(400).json({
          success: false,
          error: 'You cannot report your own post'
        });
      }

      const reportData = {
        post_id: parseInt(post_id),
        reporter_id,
        reason,
        additional_info: additional_info || ''
      };

      const reportId = await Report.create(reportData);

      // Get all admin users for notification
      const adminUsers = await db('users').where('role', 'admin').select('id');
      
      // Create notifications for all admins
      for (const admin of adminUsers) {
        await Notification.create({
          user_id: admin.id,
          title: 'New Report Submitted',
          message: `A new report has been submitted for post "${post.title}"`,
          type: 'report_submitted',
          metadata: JSON.stringify({ report_id: reportId, post_id: post_id })
        });
      }

      // Create notification for reporter
      await Notification.create({
        user_id: reporter_id,
        title: 'Report Submitted',
        message: 'Your report has been submitted and is under review',
        type: 'report_submitted',
        metadata: JSON.stringify({ report_id: reportId })
      });

      res.status(201).json({
        success: true,
        message: 'Report submitted successfully',
        reportId
      });
    } catch (error) {
      console.error('Submit report error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error submitting report'
      });
    }
  },

  getAllReports: async (req, res) => {
    try {
      const reports = await Report.getAll();
      res.json({
        success: true,
        reports
      });
    } catch (error) {
      console.error('Get reports error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching reports'
      });
    }
  },

  updateReportStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['pending', 'under_review', 'resolved', 'dismissed'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status'
        });
      }

      const report = await Report.getById(id);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'Report not found'
        });
      }

      const updated = await Report.updateStatus(id, status);

      if (updated) {
        // Create notification for reporter about status update
        await Notification.create({
          user_id: report.reporter_id,
          title: 'Report Status Updated',
          message: `Your report has been marked as ${status}`,
          type: 'report_status_update',
          metadata: JSON.stringify({ report_id: id, status })
        });

        res.json({
          success: true,
          message: `Report ${status} successfully`
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Report not found'
        });
      }
    } catch (error) {
      console.error('Update report status error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error updating report status'
      });
    }
  },

  getReportsByStatus: async (req, res) => {
    try {
      const { status } = req.params;
      const reports = await Report.getByStatus(status);
      res.json({
        success: true,
        reports
      });
    } catch (error) {
      console.error('Get reports by status error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching reports'
      });
    }
  },

  getUserReports: async (req, res) => {
    try {
      const userId = req.user.id;
      const reports = await Report.getByReporterId(userId);
      res.json({
        success: true,
        reports
      });
    } catch (error) {
      console.error('Get user reports error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching user reports'
      });
    }
  }
};

module.exports = reportController;