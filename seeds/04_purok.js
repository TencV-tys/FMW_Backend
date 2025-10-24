/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Check if puroks already exist
  const existingPuroks = await knex('puroks').first();
  
  if (existingPuroks) {
    console.log('ℹ️ Puroks already exist, skipping seed...');
    return;
  }

  // Puroks are independent - no barangay_id needed!
  const puroks = [
    { name: 'Purok 1' },
    { name: 'Purok 2' },
    { name: 'Purok 3' },
    { name: 'Purok 4' },
    { name: 'Purok 5' },
    { name: 'Purok 6' },
    { name: 'Purok 7' },
  
  ];

  await knex('puroks').insert(puroks);
  
  console.log(`✅ ${puroks.length} puroks seeded successfully!`);
};