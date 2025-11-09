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

      // 🆕 CHECK IF USER ALREADY REPORTED THIS POST THIS MONTH
      const currentDate = new Date();
      const currentMonth = currentDate.getFullYear() * 100 + (currentDate.getMonth() + 1);
      
      const existingReport = await db('reports')
        .where('post_id', post_id)
        .where('reporter_id', reporter_id)
        .where('reported_month', currentMonth)
        .first();

      if (existingReport) {
        return res.status(400).json({
          success: false,
          error: 'You have already reported this post this month. You can report it again next month if the issue persists.'
        });
      }

      const reportData = {
        post_id: parseInt(post_id),
        reporter_id,
        reason,
        additional_info: additional_info || '',
        reported_month: currentMonth,
        created_at: currentDate,
        updated_at: currentDate
      };

      const [reportId] = await db('reports').insert(reportData);

      // 🆕 GET CURRENT MONTH'S UNIQUE REPORT COUNT FOR THIS POST
      const currentMonthReportCount = await reportController._getPostReportCountThisMonth(post_id);
      
      // 🆕 GET ALL-TIME UNIQUE REPORT COUNT FOR THIS POST
      const allTimeReportCount = await reportController._getPostReportCountAllTime(post_id);

      // 🆕 CHECK IF POST REACHES THRESHOLD FOR AUTOMATIC ACTION
      if (currentMonthReportCount >= 3) {
        await reportController._handlePostReportThreshold(post_id, currentMonthReportCount, 'monthly');
      }

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
          message: `A new report has been submitted for post "${post.title}" (${currentMonthReportCount} unique reports this month, ${allTimeReportCount} total)`,
          type: 'report_submitted',
          metadata: JSON.stringify({ 
            report_id: reportId, 
            post_id: post_id,
            monthly_reports: currentMonthReportCount,
            total_reports: allTimeReportCount
          })
        });

        // Send email to admin about new report
        await emailService.sendAdminReportNotification(
          admin.email,
          admin.first_name,
          post.title,
          reason,
          additional_info,
          reportId,
          `${reporter.first_name} ${reporter.last_name}`,
          currentMonthReportCount,
          allTimeReportCount
        );
      }

      // Create notification for reporter
      await Notification.create({
        user_id: reporter_id,
        title: 'Report Submitted',
        message: `Your report has been submitted. This post now has ${currentMonthReportCount} unique reports this month.`,
        type: 'report_submitted',
        metadata: JSON.stringify({ 
          report_id: reportId,
          post_id: post_id,
          monthly_reports: currentMonthReportCount
        })
      });

      // Send confirmation email to reporter
      await emailService.sendReportSubmittedEmail(
        reporter.email,
        reporter.first_name,
        post.title,
        reason,
        additional_info,
        reportId,
        currentMonthReportCount,
        allTimeReportCount
      );

      res.status(201).json({
        success: true,
        message: 'Report submitted successfully',
        reportId,
        monthlyReports: currentMonthReportCount,
        totalReports: allTimeReportCount
      });
    } catch (error) {
      console.error('Submit report error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error submitting report'
      });
    }
  },

  // 🆕 NEW: Get current month's unique report count for a post
  _getPostReportCountThisMonth: async (postId) => {
    try {
      const currentDate = new Date();
      const currentMonth = currentDate.getFullYear() * 100 + (currentDate.getMonth() + 1);
      
      const result = await db('reports')
        .where('post_id', postId)
        .where('reported_month', currentMonth)
        .count('id as report_count')
        .first();
      
      return result ? parseInt(result.report_count) : 0;
    } catch (error) {
      console.error('Error getting post report count this month:', error);
      return 0;
    }
  },

  // 🆕 NEW: Get all-time unique report count for a post
  _getPostReportCountAllTime: async (postId) => {
    try {
      const result = await db('reports')
        .where('post_id', postId)
        .count('id as report_count')
        .first();
      
      return result ? parseInt(result.report_count) : 0;
    } catch (error) {
      console.error('Error getting post report count all time:', error);
      return 0;
    }
  },
 
  // 🆕 UPDATED: Handle when post reaches report threshold
  _handlePostReportThreshold: async (postId, reportCount, period = 'monthly') => {
    try {
      const post = await Post.getById(postId);
      if (!post) return;

      const postAuthor = await db('users')
        .where('id', post.user_id)
        .select('id', 'email', 'first_name', 'last_name')
        .first();

      // Notify admins about threshold reached
      const adminUsers = await db('users').where('role', 'admin').select('id', 'email', 'first_name');
      
      for (const admin of adminUsers) {
        await Notification.create({
          user_id: admin.id,
          title: `⚠️ Post Report Threshold Reached (${period})`,
          message: `Post "${post.title}" has reached ${reportCount} unique ${period} reports and may require action.`,
          type: 'report_threshold_reached',
          metadata: JSON.stringify({
            post_id: postId,
            report_count: reportCount,
            period: period,
            threshold: 3,
            post_title: post.title,
            author_name: `${postAuthor.first_name} ${postAuthor.last_name}`
          }),
          is_read: false,
          created_at: new Date()
        });
      }

      console.log(`⚠️ Post ${postId} reached ${reportCount} unique ${period} reports`);
    } catch (error) {
      console.error('Error handling post report threshold:', error);
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
  },
  // Add this method to reportController
deleteUserReport: async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if report exists and belongs to user
    const report = await db('reports')
      .where('id', id)
      .where('reporter_id', userId)
      .first();

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found or you do not have permission to delete it'
      });
    }

    // Check if report can be deleted (only pending or under_review)
    if (!['pending', 'under_review','resolved'].includes(report.status)) {
      return res.status(400).json({
        success: false,
        error: 'Only pending or under review reports can be deleted'
      });
    }

    // Delete the report
    await db('reports').where('id', id).delete();

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error deleting report'
    });
  }
},
 // DELETE REPORT - ADMIN ONLY
 // DELETE REPORT - ADMIN ONLY
deleteReport: async (req, res) => {
  try {
    const { id } = req.params;

    // Check if report exists
    const report = await db('reports')
      .where('id', id)
      .first();

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // 🆕 CHECK IF REPORT CAN BE DELETED (only dismissed or resolved)
    if (!['dismissed', 'resolved'].includes(report.status)) {
      return res.status(400).json({
        success: false,
        error: 'Only dismissed or resolved reports can be deleted'
      });
    }

    // Get detailed report information for notifications
    const reportDetails = await db('reports')
      .where('reports.id', id)
      .join('users as reporters', 'reports.reporter_id', 'reporters.id')
      .join('posts', 'reports.post_id', 'posts.id')
      .join('users as post_authors', 'posts.user_id', 'post_authors.id')
      .select(
        'reports.*',
        'reporters.first_name as reporter_first_name',
        'reporters.last_name as reporter_last_name',
        'reporters.email as reporter_email',
        'posts.title as post_title',
        'post_authors.first_name as post_author_first_name',
        'post_authors.last_name as post_author_last_name'
      )
      .first();

    // Delete the report
    await db('reports').where('id', id).delete();

    const currentTime = new Date();
    const notificationsToInsert = [];

    // Create admin notification for audit trail
    const adminNotification = {
      user_id: req.user.id,
      title: 'Report Deleted',
      message: `You deleted report #${id} for post "${reportDetails.post_title}" by ${reportDetails.post_author_first_name} ${reportDetails.post_author_last_name}`,
      type: 'report_deleted',
      metadata: JSON.stringify({
        report_id: id,
        post_id: reportDetails.post_id,
        post_title: reportDetails.post_title,
        reporter_name: `${reportDetails.reporter_first_name} ${reportDetails.reporter_last_name}`,
        post_author_name: `${reportDetails.post_author_first_name} ${reportDetails.post_author_last_name}`,
        reason: reportDetails.reason,
        status: reportDetails.status,
        deleted_by: req.user.id,
        deleted_at: currentTime
      }),
      is_read: false,
      created_at: currentTime
    };
    notificationsToInsert.push(adminNotification);

    // 🆕 ALWAYS SEND NOTIFICATION AND EMAIL TO REPORTER WHEN REPORT IS DELETED
    const reporterNotification = {
      user_id: reportDetails.reporter_id,
      title: 'Report Deleted by Administrator',
      message: `Your report for post "${reportDetails.post_title}" has been deleted by an administrator.`,
      type: 'report_deleted',
      metadata: JSON.stringify({
        report_id: id,
        post_id: reportDetails.post_id,
        post_title: reportDetails.post_title,
        deleted_by_admin: true,
        deleted_at: currentTime
      }),
      is_read: false,
      created_at: currentTime
    };
    notificationsToInsert.push(reporterNotification);

    // 🆕 ALWAYS SEND EMAIL TO REPORTER WHEN REPORT IS DELETED
    await emailService.sendReportDeletedEmail(
      reportDetails.reporter_email,
      reportDetails.reporter_first_name,
      reportDetails.post_title,
      reportDetails.reason,
      id
    );

    // Insert all notifications
    if (notificationsToInsert.length > 0) {
      await db('notifications').insert(notificationsToInsert);
    }

    res.json({
      success: true,
      message: 'Report deleted successfully',
      deletedReport: {
        id: parseInt(id),
        post_title: reportDetails.post_title,
        reporter_name: `${reportDetails.reporter_first_name} ${reportDetails.reporter_last_name}`
      }
    });

  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error deleting report'
    });
  }
},
// 🆕 UPDATE USER REPORT
updateUserReport: async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, additional_info } = req.body;
    const userId = req.user.id;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Reason is required'
      });
    }

    // Check if report exists and belongs to user
    const report = await db('reports')
      .where('id', id)
      .where('reporter_id', userId)
      .first();

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found or you do not have permission to edit it'
      });
    }

    // Check if report can be edited (only pending or under_review)
    if (!['pending', 'under_review'].includes(report.status)) {
      return res.status(400).json({
        success: false,
        error: 'Only pending or under review reports can be edited'
      });
    }

    // Update the report
    const updateData = {
      reason: reason.trim(),
      additional_info: additional_info ? additional_info.trim() : '',
      updated_at: new Date()
    };

    await db('reports')
      .where('id', id)
      .update(updateData);

    // Get updated report with post info
    const updatedReport = await db('reports')
      .where('reports.id', id)
      .join('posts', 'reports.post_id', 'posts.id')
      .select('reports.*', 'posts.title as post_title')
      .first();

    // Create notification for admins about report update
    const adminUsers = await db('users').where('role', 'admin').select('id', 'email', 'first_name');
    
    for (const admin of adminUsers) {
      await Notification.create({
        user_id: admin.id,
        title: 'Report Updated',
        message: `Report for post "${updatedReport.post_title}" has been updated by the reporter`,
        type: 'report_updated',
        metadata: JSON.stringify({ 
          report_id: id, 
          post_id: updatedReport.post_id,
          previous_reason: report.reason,
          new_reason: updateData.reason
        })
      });
    }

    res.json({
      success: true,
      message: 'Report updated successfully',
      report: updatedReport
    });

  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error updating report'
    });
  }
},

};

module.exports = reportController; 