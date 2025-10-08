const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
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

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1️⃣ Check if user exists
    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 2️⃣ Validate password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 3️⃣ Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 4️⃣ Store token in secure cookie (no localStorage needed)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    // 5️⃣ Send back success response
    res.json({
      success: true,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        gender: user.gender,
        profile_photo: user.profile_photo,
        role: user.role || 'user',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const me = async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db('users').where({ id: decoded.id }).first();

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        gender: user.gender,
        profile_photo: user.profile_photo,
        role: user.role || 'user',
      }
    });

  } catch (error) {
    console.error('Auth me error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};


const logout = async (req,res) => {
  res.clearCookie('token');
  res.json(
    {
      message: "Logged out succesfully"
    }
  )
};


module.exports = { register, login, me , logout };
