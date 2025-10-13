/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
   return knex.schema.createTable('notifications', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.string('title').notNullable();
    table.text('message').notNullable();
    table.enu('type', ['report_submitted', 'report_status_update', 'post_removed', 'general']).notNullable();
    table.boolean('is_read').defaultTo(false);
    table.json('metadata'); // For additional data like report_id, post_id, etc.
    table.timestamps(true, true);
    
    // Foreign key - using your existing users table
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    
    // Indexes for performance
    table.index(['user_id', 'is_read']);
    table.index(['type']);
    table.index(['created_at']); // For sorting
  });



};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
   return knex.schema.dropTable('notifications');
};
