const db = require('../config/db');

const Purok = {
  // Get all puroks
  getAll: async () => {
    return await db('puroks')
      .select('*')
      .orderBy('name', 'asc');
  },

  // Get purok by ID
  getById: async (id) => {
    return await db('puroks')
      .where('id', id)
      .first();
  }
};

module.exports = Purok;