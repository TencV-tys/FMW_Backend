/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
   return knex.schema.createTable('banned_emails', function(table) {
    table.increments('id').primary();
    table.string('email', 100).notNullable().unique();
    table.text('reason');
    table.timestamp('banned_at').defaultTo(knex.fn.now());
    table.integer('banned_by').unsigned().notNullable();
    table.foreign('banned_by').references('id').inTable('users');
    
    // Index for better performance
    table.index('email');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
   return knex.schema.dropTable('banned_emails');
};
