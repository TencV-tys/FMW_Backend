const bcrypt = require('bcrypt');
require('dotenv').config();
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  // Deletes ALL existing admins
  await knex('users').where({ role: 'admin' }).del();
 

   // 🆕 CHECK if env variables exist
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASS) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASS environment variables are required');
  }

  
  // Hash the password
  const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASS, 10);

  // Insert default admin user
  await knex('users').insert([
    {
      first_name: 'Admin',
      last_name: 'Administrator',
      email:process.env.ADMIN_EMAIL,
      password:process.env.ADMIN_PASS,
      role: 'admin',
      gender: 'N/A',
      profile_photo: null,
    },
  ]);

  console.log('✅ Admin user seeded successfully');
};
