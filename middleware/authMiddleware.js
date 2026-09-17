const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
	const authorizationHeader = req.headers.authorization;

	if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
		return res.status(401).json({ message: "Authentication required" });
	}

	const token = authorizationHeader.slice(7).trim();

	if (!token || !process.env.JWT_SECRET) {
		return res.status(401).json({ message: "Invalid or expired token" });
	}

	try {
		const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
		const userId = decodedToken.id;

		if (!userId || !mongoose.isValidObjectId(userId)) {
			return res.status(401).json({ message: "Invalid or expired token" });
		}

		const user = await User.findById(userId);

		if (!user) {
			return res.status(401).json({ message: "User not found" });
		}

		req.user = user;
		return next();
	} catch (error) {
		return res.status(401).json({ message: "Invalid or expired token" });
	}
};

module.exports = authMiddleware;