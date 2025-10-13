/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    table.text('suspension_reason').nullable();
    table.timestamp('suspended_until').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
   return knex.schema.table('users', function(table) {
    table.dropColumn('suspension_reason');
    table.dropColumn('suspended_until');
  });
};
