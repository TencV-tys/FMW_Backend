/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
   return knex.schema.createTable('resolution_requests', function(table) {
    table.increments('id').primary();
    table.integer('post_id').unsigned().notNullable();
    table.integer('user_id').unsigned().notNullable();
    table.text('resolution_description').notNullable(); // How it was resolved
    table.string('resolution_photo', 255).nullable();  // Proof photo (optional)
    table.text('verification_details').nullable();     // How they verified it's resolved
    table.enu('status', ['pending', 'approved', 'rejected']).defaultTo('pending');
    table.text('admin_notes').nullable();              // Admin comments
    table.timestamps(true, true);
    
    // Foreign keys
    table.foreign('post_id').references('id').inTable('posts').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    
    // Indexes
    table.index(['status']);
    table.index(['post_id']);
    table.index(['user_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
   return knex.schema.dropTableIfExists('resolution_requests');
};
 