const db = require('../config/db');

const Category = {
    getAll:async()=>{
        return await db('categories').select('*').orderBy('name');
    }
};

module.exports = Category;