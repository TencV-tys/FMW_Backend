/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
   return knex.schema.raw(`
    ALTER TABLE notifications 
    MODIFY COLUMN type ENUM(
      'report_submitted', 
      'report_status_update', 
      'post_resolved',
      'post_removed', 
      'post_deleted',
      'post_restored',
      'account_status_change',
      'general'
    ) NOT NULL
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.raw(`
    ALTER TABLE notifications 
    MODIFY COLUMN type ENUM(
      'report_submitted', 
      'report_status_update', 
      'post_resolved',
      'post_removed', 
      'post_deleted',
      'post_restored',
      'general'
    ) NOT NULL
  `);
};
