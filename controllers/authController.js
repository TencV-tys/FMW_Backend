const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createUser, findUserByEmail } = require('../models/User');

const register = async (req, res) => {
  try {
    const { first_name, last_name, email, gender, password, password_confirmation } = req.body;

    if (!first_name || !email || !password || !password_confirmation) {
      return res.status(400).json({ message: "All required fields must be filled" });
    }

    if (password !== password_confirmation) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await createUser({
      first_name,
      last_name,
      email,
      gender,
      password: hashedPassword
    });

    return res.status(201).json({ message: "Registered successfully" });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { register };
