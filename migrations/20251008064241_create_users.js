/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  
  return knex.schema.createTable('users', function(table) {
    table.increments('id').primary();
    table.string('first_name',50).notNullable();
    table.string('last_name',50).notNullable();
    table.string('email',100).notNullable().unique();
    table.string('password',255).notNullable();
    table.string('gender',10).nullable();
    table.string('profile_photo',255);
    table.enu('status',['active','suspended','banned']).defaultTo('active');
    table.enu('role', ['user', 'admin']).defaultTo('user');
    table.timestamps(true, true); // created_at & updated_at
  });



};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
   return knex.schema.dropTableIfExists('users');
};
