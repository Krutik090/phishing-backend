const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Superadmin login
router.post('/superadmin/login', authController.superadminLogin);

// Tenant user login
router.post('/tenant/login', authController.userLogin);

// Register via invitation
router.post('/register', authController.register);

// Email verification
router.post('/verify-email', authController.verifyEmail);

// Forgot password
router.post('/forgot-password', authController.forgotPassword);

// Reset password
router.post('/reset-password', authController.resetPassword);

module.exports = router;
