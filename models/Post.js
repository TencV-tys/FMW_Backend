const db = require('../config/db');

const Post = {

  create: async (postData) => {
    const [postId] = await db('posts').insert({
      ...postData,
      status: 'Active'
    });
    return postId;
  },

  // Get post by ID
  getById: async (id) => {
    return await db('posts')
      .where('posts.id', id)
      .join('categories', 'posts.category_id', 'categories.id')
      .join('barangays', 'posts.barangay_id', 'barangays.id')
      .select(
        'posts.*',
        'categories.name as category_name',
        'barangays.name as barangay_name'
      )
      .first();
  },

  // Update post
  update: async (id, updateData) => {
    return await db('posts')
      .where('id', id)
      .update(updateData);
  },

  // Get all ACTIVE posts for bulletin board
  getAllActive: async () => {
    return await db('posts')
      .where('posts.status', 'Active')
      .join('users', 'posts.user_id', 'users.id')
      .join('categories', 'posts.category_id', 'categories.id')
      .join('barangays', 'posts.barangay_id', 'barangays.id')
      .select(
        'posts.*',
        'users.first_name',
        'users.last_name',
        'users.profile_photo as user_photo',
        'categories.name as category_name',
        'barangays.name as barangay_name'
      )
      .orderBy('posts.created_at', 'desc');
  },

  // Get posts by user ID
  getByUserId: async (userId) => {
    return await db('posts')
      .where('user_id', userId)
      .join('categories', 'posts.category_id', 'categories.id')
      .join('barangays', 'posts.barangay_id', 'barangays.id')
      .select(
        'posts.*',
        'categories.name as category_name',
        'barangays.name as barangay_name'
      )
      .orderBy('posts.created_at', 'desc');
  },

  // Remove post from public view
  remove: async (postId) => {
    return await db('posts')
      .where('id', postId)
      .update({
        status: 'Removed',
        updated_at: new Date()
      });
  },

  // Delete post permanently
  delete: async (postId) => {
    return await db('posts').where('id', postId).delete();
  }
};

module.exports = Post;