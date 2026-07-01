const express = require('express');
const router = express.Router();
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser
} = require('../controllers/userController');
const { protect, restrictTo } = require('../middleware/auth');

router.get('/', protect, getUsers);
router.post('/', protect, restrictTo('Super Admin', 'Admin'), createUser);
router.put('/:id', protect, restrictTo('Super Admin', 'Admin'), updateUser);
router.delete('/:id', protect, restrictTo('Super Admin', 'Admin'), deleteUser);

module.exports = router;
