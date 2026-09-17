const express = require("express");
const { searchUsers } = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/search", authMiddleware, searchUsers);

module.exports = router;