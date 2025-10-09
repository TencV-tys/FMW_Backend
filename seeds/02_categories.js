/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('categories').del();

  await knex('categories').insert([
        { name: 'Wallets' },
        { name: 'IDs / Cards' },
        { name: 'Phones' },
        { name: 'Keys' },
        { name: 'Bags' },
        { name: 'Jewelry' },
        { name: 'Gadgets' },
        { name: 'Clothes' },
        { name: 'Pets' },
        { name:"Person"},
        { name:'Accessories'},
        { name:'Documents'},
        { name:'Others'}
  ]);
};
