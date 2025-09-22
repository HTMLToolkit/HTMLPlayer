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

    // Store token data (including refresh token if available)
    userTokens[user.id] = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000),
      scope: tokenData.scope
    };

    console.log("User logged in:", user.username, "ID:", user.id);
    res.send(`
      <html>
        <head><title>Discord Authorization Complete</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>Successfully connected to Discord!</h2>
          <p>Logged in as: <strong>${user.username}#${user.discriminator || '0000'}</strong></p>
          <p>Your Discord User ID: <strong>${user.id}</strong></p>
          <p>You can now close this tab and return to HTMLPlayer.</p>
          <p><em>Copy your User ID above and paste it into HTMLPlayer settings.</em></p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("OAuth Error:", err.response?.data || err.message);
    res.status(500).send("OAuth2 flow failed");
  }
});

// --- Update Rich Presence
app.post("/presence", async (req, res) => {
  const { userId, details, state } = req.body;
  const tokenData = userTokens[userId];

  if (!tokenData) return res.status(400).send("User not authorized");

  try {
    // Check if token is expired and needs refresh
    let accessToken = tokenData.access_token;
    if (tokenData.expires_at && Date.now() > tokenData.expires_at) {
      // Token expired - would need refresh logic here
      return res.status(401).send("Token expired - please re-authorize");
    }

    await setActivity(accessToken, { details, state });
    res.json({ message: "Presence updated" });
  } catch (err) {
    console.error("Presence Error:", err.response?.data || err.message);
    res.status(500).send("Failed to update presence");
  }
});

// --- Check authorization status
app.get("/auth/status/:userId", async (req, res) => {
  const { userId } = req.params;
  const tokenData = userTokens[userId];

  if (!tokenData) {
    return res.json({ authorized: false });
  }

  const isExpired = tokenData.expires_at && Date.now() > tokenData.expires_at;
  res.json({ 
    authorized: !isExpired,
    expires_at: tokenData.expires_at,
    scope: tokenData.scope
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
