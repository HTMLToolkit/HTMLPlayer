import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { exchangeCodeForToken, getUserInfo, setActivity } from "./discord.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// In-memory token storage
const userTokens = {};

// --- Root
app.get("/", (req, res) => {
  res.send("HTMLPlayer Backend is running");
});

// --- OAuth2 callback
app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("No code provided");

  try {
    const tokenData = await exchangeCodeForToken(code);
    const user = await getUserInfo(tokenData.access_token);

    // Store token in memory
    userTokens[user.id] = tokenData.access_token;

    console.log("User logged in:", user.username);
    res.send(`Logged in as ${user.username}. You can now close this tab.`);
  } catch (err) {
    console.error("OAuth Error:", err.response?.data || err.message);
    res.status(500).send("OAuth2 flow failed");
  }
});

// --- Update Rich Presence
app.post("/presence", async (req, res) => {
  const { userId, details, state } = req.body;
  const token = userTokens[userId];

  if (!token) return res.status(400).send("User not authorized");

  try {
    await setActivity(token, { details, state });
    res.json({ message: "Presence updated" });
  } catch (err) {
    console.error("Presence Error:", err.response?.data || err.message);
    res.status(500).send("Failed to update presence");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
