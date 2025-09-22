import axios from "axios";

const DISCORD_API = "https://discord.com/api/v10";

export async function exchangeCodeForToken(code) {
  const params = new URLSearchParams();
  params.append("client_id", process.env.DISCORD_CLIENT_ID);
  params.append("client_secret", process.env.DISCORD_CLIENT_SECRET);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", process.env.DISCORD_REDIRECT_URI);

  const res = await axios.post(`${DISCORD_API}/oauth2/token`, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
  return res.data; // access_token, refresh_token, expires_in
}

export async function getUserInfo(token) {
  const res = await axios.get(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data; // user object
}

export async function setActivity(token, activity) {
  // For now, placeholder. Discord RPC activities via API are limited.
  // If RPC endpoint is unavailable, this will need Gateway/RPC connection.

  console.log("Would update Rich Presence:", activity);

  // TODO: Implement RPC presence once available via API/gateway
}
