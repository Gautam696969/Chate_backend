const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const safeErrorMessage = (error) =>
	String(error?.message || "Unknown registration error")
		.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, "[redacted-mongodb-uri]")
		.replace(/password=[^&\s]+/gi, "password=[redacted]");

const publicUser = (user) => ({
	id: user._id,
	name: user.name,
	email: user.email,
	profileImage: user.profileImage ?? null,
});

const validateRegistrationInput = ({ name, email, password }) => {
	if (typeof name !== "string" || !name.trim()) {
		return "Name is required";
	}

	if (name.trim().length < 2) {
		return "Name must be at least 2 characters";
	}

	if (typeof email !== "string" || !email.trim()) {
		return "Email is required";
	}

	if (!emailPattern.test(email.trim())) {
		return "Please provide a valid email";
	}

	if (typeof password !== "string" || !password) {
		return "Password is required";
	}

	if (password.length < 6) {
		return "Password must be at least 6 characters";
	}

	return null;
};

const validateLoginInput = ({ email, password }) => {
	if (
		typeof email !== "string" ||
		!emailPattern.test(email.trim()) ||
		typeof password !== "string" ||
		!password
	) {
		return "Email and password are required";
	}

	return null;
};

const register = async (req, res) => {
	try {
		const { name, email, password, profileImage } = req.body || {};
		const validationError = validateRegistrationInput({ name, email, password });

		if (validationError) {
			return res.status(400).json({ message: validationError });
		}

		const normalizedEmail = email.trim().toLowerCase();
		const existingUser = await User.findOne({ email: normalizedEmail });

		if (existingUser) {
			return res.status(409).json({ message: "Email already registered" });
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		const user = await User.create({
			name: name.trim(),
			email: normalizedEmail,
			password: hashedPassword,
			profileImage,
		});

		return res.status(201).json({
			message: "Registration successful",
			user: publicUser(user),
		});
	} catch (error) {
		if (error.code === 11000) {
			return res.status(409).json({ message: "Email already registered" });
		}

		if (error.name === "ValidationError") {
			return res.status(400).json({ message: error.message });
		}

		const errorMessage = safeErrorMessage(error);
		console.error("Registration failed:", errorMessage);

		const response = { message: "Server error" };
		if (process.env.NODE_ENV !== "production") {
			response.error = errorMessage;
		}

		return res.status(500).json(response);
	}
};

const login = async (req, res) => {
	try {
		const { email, password } = req.body;
		const validationError = validateLoginInput({ email, password });

		if (validationError) {
			return res.status(400).json({ message: validationError });
		}

		if (!process.env.JWT_SECRET) {
			return res.status(500).json({ message: "JWT_SECRET is not configured" });
		}

		const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password");
		const passwordMatches = user && (await bcrypt.compare(password, user.password));

		if (!passwordMatches) {
			return res.status(401).json({ message: "Invalid email or password" });
		}

		const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

		return res.status(200).json({
			token,
			user: publicUser(user),
		});
	} catch (error) {
		return res.status(500).json({ message: "Server error" });
	}
};

const getMe = (req, res) => {
	return res.status(200).json({ user: publicUser(req.user) });
};

module.exports = { register, login, getMe };
