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

    // 🎯 CHECK IF EMAIL IS BANNED
    const isEmailBanned = await db('banned_emails').where('email', email).first();
    if (isEmailBanned) {
      return res.status(400).json({ 
        message: "This email address has been banned and cannot be used for registration. Please contact support if you believe this is an error." 
      });
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

// NEW: Email availability check endpoint
const checkEmail = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email parameter is required'
      });
    }

    // Basic email format validation
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // 🎯 CHECK IF EMAIL IS BANNED
    const isEmailBanned = await db('banned_emails').where('email', email).first();
    if (isEmailBanned) {
      return res.json({
        available: false,
        message: 'This email has been banned and cannot be used for registration'
      });
    }

    // Check if email exists in database
    const existingUser = await findUserByEmail(email);
    
    if (existingUser) {
      return res.json({
        available: false,
        message: 'This email is already registered'
      });
    }

    // Email is available
    return res.json({
      available: true,
      message: 'Email is available'
    });

  } catch (error) {
    console.error('Email check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error checking email availability'
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 🎯 CHECK IF EMAIL IS BANNED (in case someone tries to login with banned email)
    const isEmailBanned = await db('banned_emails').where('email', email).first();
    if (isEmailBanned) {
      return res.status(403).json({ 
        message: "This email address has been banned. Please contact administrator." 
      });
    }
    
    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or wrong email' });
    }

    // Verify user is not suspended/banned
    if (user.status === 'suspended') {
      let message = 'Your account has been suspended.';
      if (user.suspended_until) {
        const untilDate = new Date(user.suspended_until);
        const now = new Date();
        if (untilDate > now) {
          const diffTime = untilDate - now;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          message += ` It will be automatically reactivated in ${diffDays} day(s).`;
        }
      }
      if (user.suspension_reason) {
        message += ` Reason: ${user.suspension_reason}`;
      }
      return res.status(403).json({ message });
    }

    if (user.status === 'banned') {
      let message = 'Your account has been permanently banned.';
      if (user.suspension_reason) {
        message += ` Reason: ${user.suspension_reason}`;
      }
      message += ' Please contact administrator for more information.';
      return res.status(403).json({ message });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid password or wrong password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role || 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Store token in secure cookie (no localStorage needed)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

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

    // Check if user is suspended or banned
    if (user.status === 'suspended' || user.status === 'banned') {
      return res.status(403).json({ 
        message: `Your account has been ${user.status}. Please contact administrator.` 
      });
    }

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

module.exports = { 
  register, 
  login, 
  me, 
  logout, 
  checkEmail // Export the new function
};