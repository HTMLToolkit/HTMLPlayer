import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { exchangeCodeForToken, getUserInfo, setActivity } from "./discord.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Root
app.get("/", (req, res) => {
  res.send("HTMLPlayer Backend is running");
});

// --- OAuth2 callback
app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send("No code provided");
  }

  try {
    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code);

    // Fetch user info
    const user = await getUserInfo(tokenData.access_token);

    // (TODO: Save token + user to DB, right now just in memory)
    console.log("User logged in:", user);

    // Respond back
    res.json({
      message: "OAuth2 success",
      user,
      tokenData
    });
  } catch (err) {
    console.error("OAuth Error:", err.response?.data || err.message);
    res.status(500).send("OAuth2 flow failed");
  }
});

// --- Endpoint to update Discord Rich Presence
app.post("/presence", async (req, res) => {
  const { token, details, state } = req.body;

  if (!token) {
    return res.status(400).send("Missing user token");
  }

  try {
    await setActivity(token, {
      details: details || "Listening in HTMLPlayer",
      state: state || "Enjoying the songs"
    });
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
