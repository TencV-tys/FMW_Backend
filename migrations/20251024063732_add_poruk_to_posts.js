/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.table('posts', function(table) {
    table.integer('purok_id').unsigned().nullable();
    table.foreign('purok_id').references('id').inTable('puroks').onDelete('SET NULL');
    table.index(['purok_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('posts', function(table) {
    table.dropForeign('purok_id');
    table.dropColumn('purok_id');
});
}