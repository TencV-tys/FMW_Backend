/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
return knex.schema.alterTable('reports', function(table) {
    table.integer('reported_month').notNullable();
    table.unique(['reporter_id', 'post_id', 'reported_month']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
 return knex.schema.alterTable('reports', function(table) {
    table.dropUnique(['reporter_id', 'post_id', 'reported_month']);
    table.dropColumn('reported_month');
  });
};
