/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('posts', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.string('title', 100).notNullable();
    table.text('description').notNullable();
    table.enu('type', ['Lost', 'Found']).notNullable();
    table.integer('category_id').unsigned().notNullable();
    table.integer('barangay_id').unsigned().notNullable();
    table.string('color', 50).nullable();
    table.text('contact_info').notNullable();
    table.string('photo', 255).nullable();
    
    // ✅ Default to 'Active' - posts are public immediately
    table.enu('status', ['Active', 'Removed', 'Resolved']).defaultTo('Active');
    
    table.timestamps(true, true);
    
    // Foreign keys
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('category_id').references('id').inTable('categories');
    table.foreign('barangay_id').references('id').inTable('barangays');
    
    // Indexes
    table.index(['user_id']);
    table.index(['status']); // For filtering active/removed posts
    table.index(['type']);
    table.index(['category_id']);
  });



};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
   return knex.schema.dropTableIfExists('posts');
};
