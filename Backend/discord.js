import axios from "axios";

const DISCORD_API = "https://discord.com/api/v10";

// Exchange code for OAuth token
export async function exchangeCodeForToken(code) {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_REDIRECT_URI) {
    throw new Error("Missing Discord environment variables. Check DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, and DISCORD_REDIRECT_URI");
  }

  const params = new URLSearchParams();
  params.append("client_id", process.env.DISCORD_CLIENT_ID);
  params.append("client_secret", process.env.DISCORD_CLIENT_SECRET);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", process.env.DISCORD_REDIRECT_URI);

  console.log("Exchanging code for token with redirect URI:", process.env.DISCORD_REDIRECT_URI);

  const res = await axios.post(`${DISCORD_API}/oauth2/token`, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
  
  console.log("Token exchange successful, scopes:", res.data.scope);
  return res.data; // access_token, refresh_token, expires_in
}

// Get Discord user info
export async function getUserInfo(token) {
  const res = await axios.get(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data; // user object
}

// Update Rich Presence activity using Discord RPC
export async function setActivity(token, { details, state }) {
  // For Rich Presence, we need to use the RPC API
  // This requires the rpc.activities.write scope which is already included
  
  console.log("Setting Discord activity:", { details, state });

  const activity = {
    name: "HTMLPlayer",
    type: 2, // LISTENING activity type
    details: details || "Music Player",
    state: state || "Ready",
    timestamps: {
      start: Date.now()
    }
  };

  try {
    // Clear activity if both details and state are empty
    if (!details && !state) {
      console.log("Clearing Discord presence");
      // Send empty activity to clear presence
      await axios.put(
        `${DISCORD_API}/applications/${process.env.DISCORD_CLIENT_ID}/activities`,
        {},
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );
    } else {
      console.log("Setting Discord Rich Presence activity");
      // Set the Rich Presence activity
      await axios.put(
        `${DISCORD_API}/applications/${process.env.DISCORD_CLIENT_ID}/activities`,
        activity,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );
    }
    console.log("Discord activity updated successfully");
  } catch (error) {
    console.error("Failed to update Discord activity:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
}
