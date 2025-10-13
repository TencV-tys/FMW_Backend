/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  
return knex.schema.createTable('reports', function(table) {
    table.increments('id').primary();
    table.integer('post_id').unsigned().notNullable();
    table.integer('reporter_id').unsigned().notNullable();
    table.text('reason').notNullable();
    table.text('additional_info');
    table.enu('status', ['pending', 'under_review', 'resolved', 'dismissed']).defaultTo('pending');
    table.timestamps(true, true);
    
    // Foreign keys - using your existing tables
    table.foreign('post_id').references('id').inTable('posts').onDelete('CASCADE');
    table.foreign('reporter_id').references('id').inTable('users').onDelete('CASCADE');
    
    // Indexes for performance
    table.index(['post_id', 'status']);
    table.index(['reporter_id']);
    table.index(['status']);
  });


};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
   return knex.schema.dropTable('reports');
};
