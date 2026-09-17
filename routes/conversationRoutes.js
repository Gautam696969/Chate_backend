const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
	createConversation,
	getConversations,
} = require("../controllers/conversationController");
const {
	getMessages,
	sendMessage,
} = require("../controllers/messageController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createConversation);
router.get("/", getConversations);
router.get("/:conversationId/messages", getMessages);
router.post("/:conversationId/messages", sendMessage);

module.exports = router;