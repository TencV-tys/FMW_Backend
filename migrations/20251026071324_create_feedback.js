/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
   return knex.schema.createTable('feedback', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().nullable(); // Can be anonymous
    table.string('type').notNullable(); // bug, feature, suggestion, general
    table.string('title').notNullable();
    table.text('description').notNullable();
    table.string('status').defaultTo('pending'); // pending, reviewed, in_progress, completed, rejected
    table.string('priority').defaultTo('medium'); // low, medium, high, critical
    table.json('metadata').nullable(); // Additional data like browser info, screenshots, etc.
    table.text('admin_notes').nullable();
    table.integer('assigned_to').unsigned().nullable(); // Admin assigned to handle
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Foreign keys
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('assigned_to').references('id').inTable('users').onDelete('SET NULL');
    
    // Indexes for better performance
    table.index(['status']);
    table.index(['type']);
    table.index(['priority']);
    table.index(['created_at']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
   return knex.schema.dropTable('feedback');
};
