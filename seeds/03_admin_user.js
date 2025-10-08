const bcrypt = require('bcrypt');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  // Deletes ALL existing admins
  await knex('users').where({ role: 'admin' }).del();

  // Hash the password
  const hashedPassword = await bcrypt.hash('admin9087', 10);

  // Insert default admin user
  await knex('users').insert([
    {
      first_name: 'System',
      last_name: 'Administrator',
      email: 'admin@findmyway.com',
      password: hashedPassword,
      role: 'admin',
      gender: 'N/A',
      profile_photo: null,
    },
  ]);

  console.log('✅ Admin user seeded successfully');
};
