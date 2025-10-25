// controllers/reportController.js - UPDATED WITH EMAIL INTEGRATION
const Report = require('../models/Report');
const Notification = require('../models/Notification');
const Post = require('../models/Post');
const emailService = require('../services/emailService');
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

      // Get post author info
      const postAuthor = await db('users')
        .where('id', post.user_id)
        .first()
        .select('id', 'email', 'first_name', 'last_name');

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

      // Get reporter info
      const reporter = await db('users')
        .where('id', reporter_id)
        .first()
        .select('email', 'first_name', 'last_name');

      // Get all admin users for notification
      const adminUsers = await db('users').where('role', 'admin').select('id', 'email', 'first_name');
      
      // Create notifications and send emails to all admins
      for (const admin of adminUsers) {
        await Notification.create({
          user_id: admin.id,
          title: 'New Report Submitted',
          message: `A new report has been submitted for post "${post.title}"`,
          type: 'report_submitted',
          metadata: JSON.stringify({ report_id: reportId, post_id: post_id })
        });

        // Send email to admin about new report
        await emailService.sendAdminReportNotification(
          admin.email,
          admin.first_name,
          post.title,
          reason,
          additional_info,
          reportId,
          `${reporter.first_name} ${reporter.last_name}`
        );
      }

      // Create notification for reporter
      await Notification.create({
        user_id: reporter_id,
        title: 'Report Submitted',
        message: 'Your report has been submitted and is under review',
        type: 'report_submitted',
        metadata: JSON.stringify({ report_id: reportId })
      });

      // Send confirmation email to reporter
      await emailService.sendReportSubmittedEmail(
        reporter.email,
        reporter.first_name,
        post.title,
        reason,
        additional_info,
        reportId
      );

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
      const { status, admin_note } = req.body;

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
        // Get reporter info for notification
        const reporter = await db('users')
          .where('id', report.reporter_id)
          .first()
          .select('id', 'email', 'first_name');

        // Get post info
        const post = await Post.getById(report.post_id);

        // Create notification for reporter about status update
        await Notification.create({
          user_id: report.reporter_id,
          title: `Report ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}`,
          message: `Your report for post "${post.title}" has been ${status}`,
          type: 'report_status_update',
          metadata: JSON.stringify({ report_id: id, status, post_id: report.post_id })
        });

        // Send email to reporter about status update
        await emailService.sendReportStatusUpdate(
          reporter.email,
          reporter.first_name,
          post.title,
          status,
          report.reason,
          admin_note,
          id
        );

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