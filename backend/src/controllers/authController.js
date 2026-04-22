const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Admin = require('../models/Admin');
const { signAccess, signRefresh } = require('../utils/jwt');

const getProfile = async (userId, role) => {
  if (role === 'student') return Student.findOne({ userId }).lean();
  if (role === 'faculty') return Faculty.findOne({ userId }).lean();
  if (role === 'admin') return Admin.findOne({ userId }).lean();
  return null;
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found. Please contact admin' 
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account has been deactivated. Please contact admin' 
      });
    }

    // Verify password
    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Incorrect password' 
      });
    }

    // Check enrollment for student and faculty roles
    if (user.role === 'student' || user.role === 'faculty') {
      const ModelClass = user.role === 'student' ? Student : Faculty;
      const profile = await ModelClass.findOne({ userId: user._id });
      
      if (!profile) {
        return res.status(403).json({ 
          success: false, 
          message: 'You are not authorized. Contact admin' 
        });
      }
    }

    // Generate tokens
    const accessToken = signAccess(user._id, user.role);
    const refreshToken = signRefresh(user._id);
    const profile = await getProfile(user._id, user.role);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: { id: user._id, email: user.email, role: user.role, profile },
      },
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again later.' 
    });
  }
};

exports.me = async (req, res) => {
  try {
    const profile = await getProfile(req.user._id, req.user.role);
    res.json({ success: true, data: { user: { id: req.user._id, email: req.user.email, role: req.user.role, profile } } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) return res.status(401).json({ success: false, message: 'Invalid token' });
    const accessToken = signAccess(user._id, user.role);
    res.json({ success: true, data: { accessToken } });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: true, message: 'If that email exists, a reset link was sent' });

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    res.json({ success: true, message: 'Reset token generated', resetToken: token });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: new Date() } });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
