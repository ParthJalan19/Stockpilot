const express = require('express');
const router = express.Router();
const {
  registerOrganization,
  login,
  refreshAccessToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/multer');

router.post('/register', registerOrganization);
router.post('/login', login);
router.post('/refresh', refreshAccessToken);
router.post('/logout', protect, logout);

router.get('/profile', protect, getProfile);
router.put('/profile', protect, upload.single('profilePic'), updateProfile);
router.put('/change-password', protect, changePassword);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
