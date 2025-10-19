/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
   return knex.schema.table('posts', function(table) {
    table.text('reason').nullable(); // Store reason for removal/deletion
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
   return knex.schema.table('posts', function(table) {
    table.dropColumn('reason');
  });
};
