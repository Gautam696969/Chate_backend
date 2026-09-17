const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

const getToken = (socket) => {
	const authToken = socket.handshake.auth?.token;
	const authorizationHeader = socket.handshake.headers.authorization;

	if (authToken) {
		return authToken.startsWith("Bearer ") ? authToken.slice(7).trim() : authToken;
	}

	if (authorizationHeader?.startsWith("Bearer ")) {
		return authorizationHeader.slice(7).trim();
	}

	return null;
};

const toSender = (sender) => ({
	id: sender._id,
	name: sender.name,
	profileImage: sender.profileImage ?? null,
});

const toMessage = (message) => ({
	id: message._id,
	conversation: message.conversation,
	sender: toSender(message.sender),
	text: message.text,
	messageType: message.messageType,
	createdAt: message.createdAt,
	seenBy: message.seenBy || [],
});

const isParticipant = (conversation, userId) =>
	conversation.participants.some((participant) => participant.equals(userId));

const authenticateSocket = async (socket, next) => {
	const token = getToken(socket);

	if (!token || !process.env.JWT_SECRET) {
		return next(new Error("Authentication required"));
	}

	try {
		const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

		if (!decodedToken.id || !mongoose.isValidObjectId(decodedToken.id)) {
			return next(new Error("Invalid or expired token"));
		}

		const user = await User.findById(decodedToken.id);

		if (!user) {
			return next(new Error("User not found"));
		}

		socket.user = user;
		return next();
	} catch (error) {
		return next(new Error("Invalid or expired token"));
	}
};

const getAuthorizedConversation = async (conversationId, userId) => {
	if (!mongoose.isValidObjectId(conversationId)) {
		return { error: "Invalid conversation ID" };
	}

	const conversation = await Conversation.findById(conversationId);

	if (!conversation) {
		return { error: "Conversation not found" };
	}

	if (!isParticipant(conversation, userId)) {
		return { error: "You are not a participant in this conversation" };
	}

	return { conversation };
};

const registerChatSocket = (io) => {
	io.use(authenticateSocket);

	io.on("connection", (socket) => {
		const userId = socket.user._id;

		const joinConversation = async (conversationId, callback = () => {}) => {
			try {
				const result = await getAuthorizedConversation(conversationId, userId);

				if (result.error) {
					return callback({ ok: false, message: result.error });
				}

				socket.join(conversationId);
				return callback({ ok: true, conversationId });
			} catch (error) {
				return callback({ ok: false, message: "Unable to join conversation" });
			}
		};

		socket.on("join_conversation", joinConversation);
		socket.on("join_room", joinConversation);

		socket.on("send_message", async (data = {}, callback = () => {}) => {
			try {
				const { conversationId, text } = data;

				if (!conversationId || typeof text !== "string" || !text.trim()) {
					return callback({ ok: false, message: "Conversation ID and message text are required" });
				}

				const result = await getAuthorizedConversation(conversationId, userId);

				if (result.error) {
					return callback({ ok: false, message: result.error });
				}

				const message = await Message.create({
					conversation: result.conversation._id,
					sender: userId,
					text: text.trim(),
					messageType: "text",
					seenBy: [userId],
				});

				await Conversation.findByIdAndUpdate(result.conversation._id, {
					lastMessage: message.text,
					lastMessageAt: message.createdAt,
				});

				await message.populate("sender", "name profileImage");
				const response = toMessage(message);

				io.to(conversationId).emit("message_received", response);
				io.to(conversationId).emit("receive_message", response);
				return callback({ ok: true, message: response });
			} catch (error) {
				return callback({ ok: false, message: "Unable to send message" });
			}
		});

		socket.on("mark_messages_seen", async (data = {}, callback = () => {}) => {
			try {
				const { conversationId } = data;
				const result = await getAuthorizedConversation(conversationId, userId);

				if (result.error) {
					return callback({ ok: false, message: result.error });
				}

				await Message.updateMany(
					{ conversation: result.conversation._id, sender: { $ne: userId }, seenBy: { $ne: userId } },
					{ $addToSet: { seenBy: userId } }
				);

				io.to(conversationId).emit("messages_seen", {
					conversationId,
					userId,
				});

				return callback({ ok: true });
			} catch (error) {
				return callback({ ok: false, message: "Unable to mark messages as seen" });
			}
		});
	});
};

module.exports = registerChatSocket;