const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const { findAuthorizedConversation } = require("./conversationController");

const toPublicSender = (sender) => ({
	id: sender._id,
	name: sender.name,
	profileImage: sender.profileImage ?? null,
});

const toMessageResponse = (message) => ({
	id: message._id,
	conversation: message.conversation,
	sender: toPublicSender(message.sender),
	text: message.text,
	messageType: message.messageType,
	createdAt: message.createdAt,
});

const getMessages = async (req, res) => {
	try {
		const result = await findAuthorizedConversation(req.params.conversationId, req.user._id);

		if (result.error) {
			return res.status(result.error.status).json({ message: result.error.message });
		}

		const messages = await Message.find({ conversation: result.conversation._id })
			.populate("sender", "name profileImage")
			.sort({ createdAt: 1 });

		return res.status(200).json({ messages: messages.map(toMessageResponse) });
	} catch (error) {
		return res.status(500).json({ message: "Server error" });
	}
};

const sendMessage = async (req, res) => {
	try {
		const result = await findAuthorizedConversation(req.params.conversationId, req.user._id);

		if (result.error) {
			return res.status(result.error.status).json({ message: result.error.message });
		}

		if (typeof req.body?.text !== "string" || !req.body.text.trim()) {
			return res.status(400).json({ message: "Message text is required" });
		}

		const text = req.body.text.trim();
		const message = await Message.create({
			conversation: result.conversation._id,
			sender: req.user._id,
			text,
			messageType: "text",
		});

		await Conversation.findByIdAndUpdate(result.conversation._id, {
			lastMessage: text,
			lastMessageAt: message.createdAt,
		});

		await message.populate("sender", "name profileImage");

		return res.status(201).json({ message: toMessageResponse(message) });
	} catch (error) {
		return res.status(500).json({ message: "Server error" });
	}
};

module.exports = { getMessages, sendMessage };