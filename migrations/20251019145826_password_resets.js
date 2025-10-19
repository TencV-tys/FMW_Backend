/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('password_resets', function(table) {
    table.increments('id').primary();
    table.string('email', 255).notNullable().unique();
    table.text('token').notNullable();
    table.datetime('expires_at').notNullable();
    table.boolean('used').defaultTo(false);
    table.datetime('used_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
   return knex.schema.dropTable('password_resets');
};
