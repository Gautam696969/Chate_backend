const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const User = require("../models/User");

const toPublicParticipant = (participant) => ({
	id: participant._id,
	name: participant.name,
	email: participant.email,
	profileImage: participant.profileImage ?? null,
});

const toConversationResponse = (conversation) => ({
	id: conversation._id,
	participants: conversation.participants.map((participant) =>
		participant.name ? toPublicParticipant(participant) : participant
	),
	lastMessage: conversation.lastMessage,
	lastMessageAt: conversation.lastMessageAt,
});

const isParticipant = (conversation, userId) =>
	conversation.participants.some((participant) => participant.equals(userId));

const createConversation = async (req, res) => {
	try {
		const { userId } = req.body || {};

		if (!userId || !mongoose.isValidObjectId(userId)) {
			return res.status(400).json({ message: "A valid userId is required" });
		}

		if (req.user._id.equals(userId)) {
			return res.status(400).json({ message: "You cannot create a conversation with yourself" });
		}

		const otherUser = await User.findById(userId).select("_id");

		if (!otherUser) {
			return res.status(404).json({ message: "User not found" });
		}

		let conversation = await Conversation.findOne({
			participants: { $all: [req.user._id, otherUser._id], $size: 2 },
		});

		if (conversation) {
			return res.status(200).json({ conversation: toConversationResponse(conversation) });
		}

		conversation = await Conversation.create({
			participants: [req.user._id, otherUser._id],
		});

		return res.status(201).json({ conversation: toConversationResponse(conversation) });
	} catch (error) {
		return res.status(500).json({ message: "Server error" });
	}
};

const getConversations = async (req, res) => {
	try {
		const conversations = await Conversation.find({ participants: req.user._id })
			.populate("participants", "name email profileImage")
			.sort({ lastMessageAt: -1, updatedAt: -1 });

		return res.status(200).json({
			conversations: conversations.map(toConversationResponse),
		});
	} catch (error) {
		return res.status(500).json({ message: "Server error" });
	}
};

const findAuthorizedConversation = async (conversationId, userId) => {
	if (!mongoose.isValidObjectId(conversationId)) {
		return { error: { status: 400, message: "Invalid conversation ID" } };
	}

	const conversation = await Conversation.findById(conversationId);

	if (!conversation) {
		return { error: { status: 404, message: "Conversation not found" } };
	}

	if (!isParticipant(conversation, userId)) {
		return {
			error: {
				status: 403,
				message: "You are not a participant in this conversation",
			},
		};
	}

	return { conversation };
};

module.exports = {
	createConversation,
	getConversations,
	findAuthorizedConversation,
};