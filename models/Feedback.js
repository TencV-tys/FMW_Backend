const db = require('../config/db');

const Feedback = {
  create: async (feedbackData) => {
    const [feedbackId] = await db('feedback').insert(feedbackData);
    return feedbackId;
  },

  getAll: async (filters = {}) => {
    let query = db('feedback')
      .leftJoin('users as submitters', 'feedback.user_id', 'submitters.id')
      .leftJoin('users as assigned_admins', 'feedback.assigned_to', 'assigned_admins.id')
      .select(
        'feedback.*',
        'submitters.first_name as submitter_first_name',
        'submitters.last_name as submitter_last_name',
        'submitters.email as submitter_email',
        'assigned_admins.first_name as assigned_admin_first_name',
        'assigned_admins.last_name as assigned_admin_last_name'
      )
      .orderBy('feedback.created_at', 'desc');

    // Apply filters
    if (filters.status) {
      query = query.where('feedback.status', filters.status);
    }
    if (filters.type) {
      query = query.where('feedback.type', filters.type);
    }
    if (filters.priority) {
      query = query.where('feedback.priority', filters.priority);
    }
    if (filters.assigned_to) {
      query = query.where('feedback.assigned_to', filters.assigned_to);
    }

    return await query;
  },

  getById: async (id) => {
    return await db('feedback')
      .where('feedback.id', id)
      .leftJoin('users as submitters', 'feedback.user_id', 'submitters.id')
      .leftJoin('users as assigned_admins', 'feedback.assigned_to', 'assigned_admins.id')
      .select(
        'feedback.*',
        'submitters.first_name as submitter_first_name',
        'submitters.last_name as submitter_last_name',
        'submitters.email as submitter_email',
        'assigned_admins.first_name as assigned_admin_first_name',
        'assigned_admins.last_name as assigned_admin_last_name'
      )
      .first();
  },

  getByUserId: async (userId) => {
    return await db('feedback')
      .where('user_id', userId)
      .select('*')
      .orderBy('created_at', 'desc');
  },

  update: async (id, updateData) => {
    updateData.updated_at = new Date();
    return await db('feedback')
      .where('id', id)
      .update(updateData);
  },

  updateStatus: async (id, status, adminNotes = null) => {
    const updateData = {
      status,
      updated_at: new Date()
    };
    
    if (adminNotes !== null) {
      updateData.admin_notes = adminNotes;
    }
    
    return await db('feedback')
      .where('id', id)
      .update(updateData);
  },

  assignToAdmin: async (id, adminId) => {
    return await db('feedback')
      .where('id', id)
      .update({
        assigned_to: adminId,
        updated_at: new Date()
      });
  },

  getStats: async () => {
    const stats = await db('feedback')
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) as pending'),
        db.raw('SUM(CASE WHEN status = "reviewed" THEN 1 ELSE 0 END) as reviewed'),
        db.raw('SUM(CASE WHEN status = "in_progress" THEN 1 ELSE 0 END) as in_progress'),
        db.raw('SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as completed'),
        db.raw('SUM(CASE WHEN status = "rejected" THEN 1 ELSE 0 END) as rejected'),
        db.raw('SUM(CASE WHEN type = "bug" THEN 1 ELSE 0 END) as bugs'),
        db.raw('SUM(CASE WHEN type = "feature" THEN 1 ELSE 0 END) as features'),
        db.raw('SUM(CASE WHEN type = "suggestion" THEN 1 ELSE 0 END) as suggestions'),
        db.raw('SUM(CASE WHEN type = "general" THEN 1 ELSE 0 END) as general'),
        db.raw('SUM(CASE WHEN priority = "critical" THEN 1 ELSE 0 END) as critical'),
        db.raw('SUM(CASE WHEN priority = "high" THEN 1 ELSE 0 END) as high')
      )
      .first();

    return {
      total: parseInt(stats.total) || 0,
      pending: parseInt(stats.pending) || 0,
      reviewed: parseInt(stats.reviewed) || 0,
      in_progress: parseInt(stats.in_progress) || 0,
      completed: parseInt(stats.completed) || 0,
      rejected: parseInt(stats.rejected) || 0,
      bugs: parseInt(stats.bugs) || 0,
      features: parseInt(stats.features) || 0,
      suggestions: parseInt(stats.suggestions) || 0,
      general: parseInt(stats.general) || 0,
      critical: parseInt(stats.critical) || 0,
      high: parseInt(stats.high) || 0
    };
  },

  // Get feedback by status for admin
  getByStatus: async (status) => {
    return await db('feedback')
      .where('feedback.status', status)
      .leftJoin('users as submitters', 'feedback.user_id', 'submitters.id')
      .leftJoin('users as assigned_admins', 'feedback.assigned_to', 'assigned_admins.id')
      .select(
        'feedback.*',
        'submitters.first_name as submitter_first_name',
        'submitters.last_name as submitter_last_name',
        'submitters.email as submitter_email',
        'assigned_admins.first_name as assigned_admin_first_name',
        'assigned_admins.last_name as assigned_admin_last_name'
      )
      .orderBy('feedback.created_at', 'desc');
  }
};

module.exports = Feedback;