/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('barangays').del();

  await knex('barangays').insert([ 
{name:'Banlasan'},
{name:'Bongbong'},
{name:'Catoogan'},
{name:'Guinobatan'},
{name:'Hinlayagan Ilaud'},
{name:'Hinlayagan Ilaya'},
{name:'Kauswagan'},
{name:'Kinan-o-an'},
{name:'La victoria'},
{name:'La union'},
{name:'Mabuhay'},
{name:'Mahagbu'},
{name:'Manuel M. Roxas'},
{name:'Poblacion'},
{name:'San Isidro'},
{name:'San Vicente'},
{name:'Santo Tomas'},
{name:'Soom'},
{name:'Tagum Norte'},
{name:'Tagum Sur'}
  ]); 
};
