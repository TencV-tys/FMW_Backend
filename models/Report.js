// models/Report.js - FIXED
const db = require('../config/db');

const Report = {
  create: async (reportData) => {
    const [reportId] = await db('reports').insert(reportData);
    return reportId;
  },

  getAll: async () => {
    return await db('reports')
      .join('posts', 'reports.post_id', 'posts.id')
      .join('users as reporters', 'reports.reporter_id', 'reporters.id')
      .join('users as post_authors', 'posts.user_id', 'post_authors.id')
      .select(
        'reports.*',
        'posts.title as post_title',
        'posts.description as post_description',
        'posts.user_id as post_owner_id',
        'reporters.first_name as reporter_first_name',
        'reporters.last_name as reporter_last_name',
        'post_authors.first_name as post_author_first_name',
        'post_authors.last_name as post_author_last_name',
        db.raw("CONCAT(reporters.first_name, ' ', reporters.last_name) as reporter_name"),
        db.raw("CONCAT(post_authors.first_name, ' ', post_authors.last_name) as post_author_name")
      )
      .orderBy('reports.created_at', 'desc');
  },

  getById: async (id) => {
    return await db('reports')
      .where('reports.id', id)
      .join('posts', 'reports.post_id', 'posts.id')
      .join('users as reporters', 'reports.reporter_id', 'reporters.id')
      .join('users as post_authors', 'posts.user_id', 'post_authors.id')
      .select(
        'reports.*',
        'posts.title as post_title',
        'posts.description as post_description',
        'posts.user_id as post_owner_id',
        'reporters.first_name as reporter_first_name',
        'reporters.last_name as reporter_last_name',
        'post_authors.first_name as post_author_first_name',
        'post_authors.last_name as post_author_last_name',
        db.raw("CONCAT(reporters.first_name, ' ', reporters.last_name) as reporter_name"),
        db.raw("CONCAT(post_authors.first_name, ' ', post_authors.last_name) as post_author_name")
      )
      .first();
  },

  updateStatus: async (id, status) => {
    return await db('reports')
      .where('id', id)
      .update({
        status,
        updated_at: new Date()
      });
  },

  getByStatus: async (status) => {
    return await db('reports')
      .where('reports.status', status) // FIXED: Changed 'status' to 'reports.status'
      .join('posts', 'reports.post_id', 'posts.id')
      .join('users as reporters', 'reports.reporter_id', 'reporters.id')
      .join('users as post_authors', 'posts.user_id', 'post_authors.id')
      .select(
        'reports.*',
        'posts.title as post_title',
        'reporters.first_name as reporter_first_name',
        'reporters.last_name as reporter_last_name',
        'post_authors.first_name as post_author_first_name',
        'post_authors.last_name as post_author_last_name',
        db.raw("CONCAT(reporters.first_name, ' ', reporters.last_name) as reporter_name"),
        db.raw("CONCAT(post_authors.first_name, ' ', post_authors.last_name) as post_author_name")
      )
      .orderBy('reports.created_at', 'desc');
  },

  getByReporterId: async (reporterId) => {
    return await db('reports')
      .where('reports.reporter_id', reporterId) // Also fixed here for consistency
      .join('posts', 'reports.post_id', 'posts.id')
      .join('users as post_authors', 'posts.user_id', 'post_authors.id')
      .select(
        'reports.*',
        'posts.title as post_title',
        'post_authors.first_name as post_author_first_name',
        'post_authors.last_name as post_author_last_name',
        db.raw("CONCAT(post_authors.first_name, ' ', post_authors.last_name) as post_author_name")
      )
      .orderBy('reports.created_at', 'desc');
  }
};

module.exports = Report;