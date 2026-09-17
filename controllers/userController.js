const User = require("../models/User");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toPublicUser = (user) => ({
	id: user._id,
	name: user.name,
	email: user.email,
	profileImage: user.profileImage ?? null,
});

const searchUsers = async (req, res) => {
	try {
		const query = typeof req.query.query === "string" ? req.query.query.trim() : "";

		if (!query) {
			return res.status(200).json({ users: [] });
		}

		const searchPattern = new RegExp(escapeRegex(query), "i");
		const users = await User.find({
			_id: { $ne: req.user._id },
			$or: [{ name: searchPattern }, { email: searchPattern }],
		})
			.select("name email profileImage")
			.limit(20);

		return res.status(200).json({ users: users.map(toPublicUser) });
	} catch (error) {
		return res.status(500).json({ message: "Server error" });
	}
};

module.exports = { searchUsers };