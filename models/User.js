const db = require('../config/db');

const createUser = async (user) => {
  return db('users').insert(user);
};

const findUserByEmail = async (email) => {
  return db('users').where({ email }).first();
};

const deleteUser = async (id) => {
  return db('users').where({id}).del();
}

//  Update user profile
const updateUser = async (id, updateData) => {
  return db('users')
    .where('id', id)
    .update(updateData);
}

// Get user by ID
const findUserById = async (id) => {
  return db('users')
    .where('id', id)
    .select('id', 'first_name', 'last_name', 'email', 'gender', 'profile_photo', 'role', 'status', 'created_at')
    .first();
}

module.exports = {
  createUser,
  findUserByEmail,
  deleteUser,
  updateUser,
  findUserById
};