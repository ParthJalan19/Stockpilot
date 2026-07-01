const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSettings,
  downloadBackup,
  restoreBackup
} = require('../controllers/settingsController');
const { protect, restrictTo } = require('../middleware/auth');
const upload = require('../middleware/multer');

router.get('/', protect, getSettings);
router.put('/', protect, restrictTo('Super Admin', 'Admin'), upload.single('logo'), updateSettings);

router.get('/backup', protect, restrictTo('Super Admin'), downloadBackup);
router.post('/restore', protect, restrictTo('Super Admin'), restoreBackup);

module.exports = router;
