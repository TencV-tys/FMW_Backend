/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('barangays').del();

  await knex('barangays').insert([ 
{name:'banlasan'},
{name:'bongbong'},
{name:'catoogan'},
{name:'guinobatan'},
{name:'hinlayagan ilaud'},
{name:'hinlayagan ilaya'},
{name:'kauswagan'},
{name:'kinan-o-an'},
{name:'la victoria'},
{name:'la union'},
{name:'mabuhay'},
{name:'mahagbu'},
{name:'manuel m. roxas'},
{name:'poblacion'},
{name:'san isidro'},
{name:'san vicente'},
{name:'santo tomas'},
{name:'soom'},
{name:'tagum norte'},
{name:'tagum sur'}
  ]); 
};
