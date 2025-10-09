const db = require('../config/db');

const Barangay = {
    getAll:async()=>{
        return await db('barangays').select('*').orderBy('name');
    }
};

module.exports = Barangay;