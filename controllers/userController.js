const db = require('../config/db');
const {deleteUser} = require('../models/User');

const getAllUsers = async (req,res) =>{

    try{
         const users = await db('users').select('*');
          res.json(users);
    }catch(error){
       res.status(500).json({
        message:'Error fetching users'
       });
    }

};

const deleted = async ( req, res ) => {
     try{
        const id = req.params.id;
        await deleteUser(id);
        res.json({
            message:'User deleted!'
        });
     }catch(err){
       res.status(500).json({
        message:'Error deleting user'
        });
     }
} 


module.exports = {
    getAllUsers,
    deleted
};