import { User } from "../models/user.model.js";
import {
  clearAuthCookie,
  comparePassword,
  hashPassword,
  setAuthCookie,
  signAuthToken,
} from "../lib/auth.js";

function sanitizeUser(user) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    createdAt: user.createdAt,
  };
}

async function signup(req, res) {
  const fullName = req.body?.fullName?.trim();
  const email = req.body?.email?.trim().toLowerCase();
  const password = req.body?.password ?? "";

  if (!fullName || fullName.length < 2) {
    return res
      .status(400)
      .json({ message: "Full name must be at least 2 characters." });
  }

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res
      .status(400)
      .json({ message: "Please enter a valid email address." });
  }

  if (password.length < 8) {
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters." });
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return res
      .status(409)
      .json({ message: "An account with that email already exists." });
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ fullName, email, passwordHash });
  const token = signAuthToken(user._id.toString());

  setAuthCookie(res, token);

  return res.status(201).json({
    message: "Account created successfully.",
    user: sanitizeUser(user),
  });
}

async function login(req, res) {
  const email = req.body?.email?.trim().toLowerCase();
  const password = req.body?.password ?? "";

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const isMatch = await comparePassword(password, user.passwordHash);

  if (!isMatch) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const token = signAuthToken(user._id.toString());
  setAuthCookie(res, token);

  return res.json({
    message: "Welcome back.",
    user: sanitizeUser(user),
  });
}

function logout(_req, res) {
  clearAuthCookie(res);
  return res.json({ message: "Signed out successfully." });
}

function me(req, res) {
  return res.json({ user: sanitizeUser(req.user) });
}

export { login, logout, me, signup };
