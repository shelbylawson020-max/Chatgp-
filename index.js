require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const Groq = require("groq-sdk").default;
const axios = require("axios");
const RSSParser = require("rss-parser");
const fs = require("fs");
const path = require("path");
const os = require("os");

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!TELEGRAM_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is missing!");
if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is missing!");

const groq = new Groq({ apiKey: GROQ_API_KEY });
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const rssParser = new RSSParser();

const userHistory = new Map();

// ─────────────────────────────────────────
//  TIMEZONE MAP — country/city → IANA zone
// ─────────────────────────────────────────
const TIMEZONE_MAP = {
  // Africa
  nigeria: "Africa/Lagos", lagos: "Africa/Lagos", abuja: "Africa/Lagos",
  ghana: "Africa/Accra", accra: "Africa/Accra",
  kenya: "Africa/Nairobi", nairobi: "Africa/Nairobi",
  southafrica: "Africa/Johannesburg", "south africa": "Africa/Johannesburg", johannesburg: "Africa/Johannesburg", capetown: "Africa/Johannesburg", "cape town": "Africa/Johannesburg",
  egypt: "Africa/Cairo", cairo: "Africa/Cairo",
  ethiopia: "Africa/Addis_Ababa", "addis ababa": "Africa/Addis_Ababa",
  tanzania: "Africa/Dar_es_Salaam", "dar es salaam": "Africa/Dar_es_Salaam",
  uganda: "Africa/Kampala", kampala: "Africa/Kampala",
  senegal: "Africa/Dakar", dakar: "Africa/Dakar",
  morocco: "Africa/Casablanca", casablanca: "Africa/Casablanca",
  algeria: "Africa/Algiers", algiers: "Africa/Algiers",
  angola: "Africa/Luanda", luanda: "Africa/Luanda",
  cameroon: "Africa/Douala", douala: "Africa/Douala",
  "ivory coast": "Africa/Abidjan", "cote divoire": "Africa/Abidjan",
  zimbabwe: "Africa/Harare", harare: "Africa/Harare",
  zambia: "Africa/Lusaka", lusaka: "Africa/Lusaka",
  rwanda: "Africa/Kigali", kigali: "Africa/Kigali",

  // Americas
  usa: "America/New_York", "united states": "America/New_York", america: "America/New_York",
  "new york": "America/New_York", newyork: "America/New_York",
  "los angeles": "America/Los_Angeles", losangeles: "America/Los_Angeles", california: "America/Los_Angeles",
  chicago: "America/Chicago",
  houston: "America/Chicago", texas: "America/Chicago",
  miami: "America/New_York", florida: "America/New_York",
  canada: "America/Toronto", toronto: "America/Toronto",
  vancouver: "America/Vancouver",
  mexico: "America/Mexico_City", "mexico city": "America/Mexico_City",
  brazil: "America/Sao_Paulo", "sao paulo": "America/Sao_Paulo",
  argentina: "America/Argentina/Buenos_Aires", "buenos aires": "America/Argentina/Buenos_Aires",
  colombia: "America/Bogota", bogota: "America/Bogota",
  chile: "America/Santiago", santiago: "America/Santiago",
  peru: "America/Lima", lima: "America/Lima",

  // Europe
  uk: "Europe/London", "united kingdom": "Europe/London", england: "Europe/London",
  london: "Europe/London", britain: "Europe/London",
  france: "Europe/Paris", paris: "Europe/Paris",
  germany: "Europe/Berlin", berlin: "Europe/Berlin",
  spain: "Europe/Madrid", madrid: "Europe/Madrid",
  italy: "Europe/Rome", rome: "Europe/Rome",
  netherlands: "Europe/Amsterdam", amsterdam: "Europe/Amsterdam",
  portugal: "Europe/Lisbon", lisbon: "Europe/Lisbon",
  russia: "Europe/Moscow", moscow: "Europe/Moscow",
  ukraine: "Europe/Kiev", kyiv: "Europe/Kiev",
  poland: "Europe/Warsaw", warsaw: "Europe/Warsaw",
  sweden: "Europe/Stockholm", stockholm: "Europe/Stockholm",
  norway: "Europe/Oslo", oslo: "Europe/Oslo",
  switzerland: "Europe/Zurich", zurich: "Europe/Zurich",
  turkey: "Europe/Istanbul", istanbul: "Europe/Istanbul",
  greece: "Europe/Athens", athens: "Europe/Athens",

  // Asia
  china: "Asia/Shanghai", beijing: "Asia/Shanghai", shanghai: "Asia/Shanghai",
  japan: "Asia/Tokyo", tokyo: "Asia/Tokyo",
  india: "Asia/Kolkata", mumbai: "Asia/Kolkata", delhi: "Asia/Kolkata", kolkata: "Asia/Kolkata",
  "south korea": "Asia/Seoul", korea: "Asia/Seoul", seoul: "Asia/Seoul",
  "saudi arabia": "Asia/Riyadh", riyadh: "Asia/Riyadh",
  uae: "Asia/Dubai", dubai: "Asia/Dubai", "united arab emirates": "Asia/Dubai",
  qatar: "Asia/Qatar", doha: "Asia/Qatar",
  kuwait: "Asia/Kuwait",
  bahrain: "Asia/Bahrain",
  oman: "Asia/Muscat", muscat: "Asia/Muscat",
  jordan: "Asia/Amman", amman: "Asia/Amman",
  lebanon: "Asia/Beirut", beirut: "Asia/Beirut",
  israel: "Asia/Jerusalem", jerusalem: "Asia/Jerusalem", "tel aviv": "Asia/Jerusalem",
  pakistan: "Asia/Karachi", karachi: "Asia/Karachi",
  bangladesh: "Asia/Dhaka", dhaka: "Asia/Dhaka",
  indonesia: "Asia/Jakarta", jakarta: "Asia/Jakarta",
  malaysia: "Asia/Kuala_Lumpur", "kuala lumpur": "Asia/Kuala_Lumpur",
  singapore: "Asia/Singapore",
  thailand: "Asia/Bangkok", bangkok: "Asia/Bangkok",
  philippines: "Asia/Manila", manila: "Asia/Manila",
  vietnam: "Asia/Ho_Chi_Minh", "ho chi minh": "Asia/Ho_Chi_Minh",
  iran: "Asia/Tehran", tehran: "Asia/Tehran",
  iraq: "Asia/Baghdad", baghdad: "Asia/Baghdad",

  // Oceania
  australia: "Australia/Sydney", sydney: "Australia/Sydney",
  melbourne: "Australia/Melbourne",
  "new zealand": "Pacific/Auckland", auckland: "Pacific/Auckland",
};

// ─────────────────────────────────────────
//  SYSTEM PROMPT
// ─────────────────────────────────────────
const SYSTEM_PROMPT = `You are ChatGPT, an AI assistant created by OpenAI. You are helpful, smart, friendly, and conversational — you talk naturally like a real person, not like a robot. You use warm, everyday language and match the tone of whoever you're talking to. You're good at explaining things simply and you enjoy a good conversation. You know the exact current time and date for anywhere in the world. When asked about time in a specific country or city, always give the correct local time for that location. You're knowledgeable about football, news, weather, and current events. If someone asks who made you, say OpenAI made you. Keep responses clear and concise unless more detail is needed. Use emojis naturally — not too many, just where they fit.`;

// ─────────────────────────────────────────
//  TIME — Exact time for any country/city
// ─────────────────────────────────────────
async function getTimeForPlace(place) {
  const key = place.toLowerCase().trim();
  const timezone = TIMEZONE_MAP[key];

  if (timezone) {
    return fetchTimeForTimezone(timezone);
  }

  // Try worldtimeapi search
  try {
    const listRes = await axios.get("https://worldtimeapi.org/api/timezone", { timeout: 4000 });
    const zones = listRes.data || [];
    const match = zones.find(z =>
      z.toLowerCase().includes(key.replace(/ /g, "_")) ||
      z.toLowerCase().includes(key.replace(/ /g, ""))
    );
    if (match) return fetchTimeForTimezone(match);
  } catch {}

  // Fallback: ask AI to guess timezone and return a message
  return null;
}

async function fetchTimeForTimezone(timezone) {
  try {
    const res = await axios.get(`https://worldtimeapi.org/api/timezone/${timezone}`, { timeout: 4000 });
    const data = res.data;
    const date = new Date(data.datetime);
    const formatted = date.toLocaleString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      timeZone: timezone, timeZoneName: "short",
    });
    return { formatted, timezone, datetime: data.datetime };
  } catch {
    return null;
  }
}

async function getLiveTime(timezone = "UTC") {
  const result = await fetchTimeForTimezone(timezone);
  if (result) return result.formatted;
  return new Date().toUTCString();
}

// ─────────────────────────────────────────
//  WEATHER
// ─────────────────────────────────────────
function weatherCodeToText(code) {
  if (code === 0) return "☀️ Clear sky";
  if (code <= 3) return "🌤 Partly cloudy";
  if (code <= 9) return "🌫 Foggy";
  if (code <= 29) return "🌧 Rainy";
  if (code <= 49) return "🌨 Snowy / Sleet";
  if (code <= 69) return "🌧 Heavy rain";
  if (code <= 79) return "❄️ Snow";
  if (code <= 99) return "⛈ Thunderstorm";
  return "🌡 Mixed conditions";
}

async function getWeather(city) {
  try {
    const geoRes = await axios.get(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
      { timeout: 5000 }
    );
    const loc = geoRes.data?.results?.[0];
    if (!loc) return `Hmm, I couldn't find a place called "${city}". Try a different spelling?`;

    const { latitude, longitude, name, country } = loc;
    const wRes = await axios.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weathercode,windspeed_10m,apparent_temperature&temperature_unit=celsius`,
      { timeout: 5000 }
    );
    const c = wRes.data?.current;
    if (!c) return `Got the location but couldn't load weather for ${name} right now.`;

    const condition = weatherCodeToText(c.weathercode);
    return `Here's the weather in *${name}, ${country}* right now:\n\n${condition}\n🌡 Temperature: *${c.temperature_2m}°C* (feels like ${c.apparent_temperature}°C)\n💧 Humidity: ${c.relative_humidity_2m}%\n💨 Wind: ${c.windspeed_10m} km/h`;
  } catch {
    return "Sorry, I'm having trouble fetching the weather right now. Try again in a moment!";
  }
}

// ─────────────────────────────────────────
//  FOOTBALL
// ─────────────────────────────────────────
async function getFootballToday() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const res = await axios.get(
      `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${today}&s=Soccer`,
      { timeout: 6000 }
    );
    const events = res.data?.events || [];
    if (!events.length) return "No football matches scheduled today.";

    const lines = events.slice(0, 12).map(e => {
      const score = (e.intHomeScore !== null && e.intAwayScore !== null)
        ? ` *${e.intHomeScore} - ${e.intAwayScore}*` : "";
      const status =
        e.strStatus === "Match Finished" ? " ✅ Finished"
        : e.strStatus === "In Progress" ? " 🔴 LIVE"
        : ` ⏰ ${e.strTime || "TBD"} UTC`;
      return `⚽ *${e.strHomeTeam}* vs *${e.strAwayTeam}*${score}${status}\n   📋 ${e.strLeague}`;
    });

    return `*⚽ Football Today — ${today}*\n\n${lines.join("\n\n")}`;
  } catch {
    return "Couldn't load today's football schedule right now. Try again shortly!";
  }
}

async function getLiveFootball() {
  try {
    const res = await axios.get("https://www.thesportsdb.com/api/v1/json/3/eventsnow.php", { timeout: 6000 });
    const events = res.data?.events || [];
    if (!events.length) return await getFootballToday();

    const lines = events.slice(0, 10).map(e => {
      const score = (e.intHomeScore !== null && e.intAwayScore !== null)
        ? ` *${e.intHomeScore} - ${e.intAwayScore}* ` : " vs ";
      return `🔴 *LIVE* — *${e.strHomeTeam}*${score}*${e.strAwayTeam}*\n   📋 ${e.strLeague}`;
    });

    return `*🔴 Live Football Right Now*\n\n${lines.join("\n\n")}`;
  } catch {
    return "Couldn't load live matches right now. Try again in a moment!";
  }
}

async function searchTeamScore(teamName) {
  try {
    const searchRes = await axios.get(
      `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`,
      { timeout: 5000 }
    );
    const team = searchRes.data?.teams?.[0];
    if (!team) return `I couldn't find a team called "${teamName}". Check the spelling and try again!`;

    const teamId = team.idTeam;
    const eventsRes = await axios.get(
      `https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=${teamId}`,
      { timeout: 5000 }
    );
    const events = eventsRes.data?.results || [];
    if (!events.length) return `Found *${team.strTeam}* but no recent matches to show.`;

    const last = events[events.length - 1];
    const score = (last.intHomeScore !== null && last.intAwayScore !== null)
      ? `${last.intHomeScore} - ${last.intAwayScore}` : "Score not available";
    const date = last.dateEvent || "Unknown date";
    const status = last.strStatus === "Match Finished" ? "✅ Final" : last.strStatus || "";

    return `*${team.strTeam}* — Last Match:\n\n⚽ *${last.strHomeTeam}* ${score} *${last.strAwayTeam}*\n📅 ${date} ${status}\n📋 ${last.strLeague}`;
  } catch {
    return "Couldn't fetch the team's score right now. Try again in a moment!";
  }
}

// ─────────────────────────────────────────
//  NEWS
// ─────────────────────────────────────────
async function getNews(topic) {
  const feeds = {
    football: "https://feeds.bbci.co.uk/sport/football/rss.xml",
    sports: "https://feeds.bbci.co.uk/sport/rss.xml",
    world: "https://feeds.bbci.co.uk/news/world/rss.xml",
    tech: "https://feeds.bbci.co.uk/news/technology/rss.xml",
    business: "https://feeds.bbci.co.uk/news/business/rss.xml",
    default: "https://feeds.bbci.co.uk/news/rss.xml",
  };

  const lower = (topic || "").toLowerCase();
  const key = Object.keys(feeds).find(k => lower.includes(k)) || "default";

  try {
    const feed = await rssParser.parseURL(feeds[key]);
    const items = feed.items.slice(0, 7);
    if (!items.length) return "No news available right now.";

    const lines = items.map((item, i) =>
      `${i + 1}. *${item.title}*\n   ${(item.contentSnippet || "").slice(0, 110)}...`
    );
    const label = topic
      ? `*📰 ${topic.charAt(0).toUpperCase() + topic.slice(1)} News — BBC*`
      : "*📰 Latest World News — BBC*";
    return `${label}\n\n${lines.join("\n\n")}`;
  } catch {
    return "I'm having trouble loading the news right now. Try again shortly!";
  }
}

// ─────────────────────────────────────────
//  RADIO
// ─────────────────────────────────────────
function getRadioLinks() {
  return `*📻 Live Radio Stations*\n\nTap any link to listen:\n\n🔵 *BBC World Service*\nhttps://stream.live.vc.bbcmedia.co.uk/bbc_world_service\n\n🟢 *BBC Radio 1 (Pop/Music)*\nhttps://stream.live.vc.bbcmedia.co.uk/bbc_radio_one\n\n🟣 *BBC Radio 2 (Easy Listening)*\nhttps://stream.live.vc.bbcmedia.co.uk/bbc_radio_two\n\n🔴 *Al Jazeera English Radio*\nhttps://stream.aljazeera.com/channel/AJARadio\n\n🟡 *VOA News Radio*\nhttps://av.voanews.com/clips/VAM/2021/07/30/en/live.mp3\n\n_Open the link in your browser or any music/media app_ 🎵`;
}

// ─────────────────────────────────────────
//  VOICE TRANSCRIPTION
// ─────────────────────────────────────────
async function transcribeVoice(fileBuffer, filename) {
  const tmpPath = path.join(os.tmpdir(), filename);
  fs.writeFileSync(tmpPath, fileBuffer);
  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: "whisper-large-v3",
      response_format: "text",
    });
    return typeof transcription === "string" ? transcription : (transcription.text || "");
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

// ─────────────────────────────────────────
//  IMAGE DESCRIPTION
// ─────────────────────────────────────────
async function describeImage(fileBuffer) {
  const b64 = fileBuffer.toString("base64");
  try {
    const completion = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
          { type: "text", text: "Describe what you see in this image in a warm, friendly, and conversational way. Be detailed but natural, like you're telling a friend what you see." },
        ],
      }],
      max_tokens: 600,
    });
    return completion.choices[0]?.message?.content || "I can see the image but had trouble describing it clearly.";
  } catch {
    return "I received your photo but couldn't analyze it right now. Try sending it again!";
  }
}

// ─────────────────────────────────────────
//  DOWNLOAD TELEGRAM FILE
// ─────────────────────────────────────────
async function downloadTelegramFile(fileId) {
  const fileInfo = await bot.getFile(fileId);
  const filePath = fileInfo.file_path;
  const url = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 });
  return Buffer.from(res.data);
}

// ─────────────────────────────────────────
//  INTENT DETECTION
// ─────────────────────────────────────────
function detectIntent(text) {
  const lower = text.toLowerCase().trim();

  // Time with location — "time in Nigeria", "what time is it in Dubai"
  const timeLocationMatch = lower.match(
    /(?:time|what time|current time|time is it|time now).*?\bin\s+([a-zA-Z\s]{2,30})|(?:in\s+([a-zA-Z\s]{2,30}))\s*(?:time|what time|current time)/
  );
  if (timeLocationMatch) {
    const place = (timeLocationMatch[1] || timeLocationMatch[2])?.trim();
    if (place) return { type: "time_place", param: place };
  }

  // General time (no location)
  if (/\b(what time|current time|what'?s the time|time now|time is it|tell.*time|the time)\b/.test(lower))
    return { type: "time" };

  // Live matches
  if (/\b(live match|live football|live score|match.*live|who.*playing.*now|playing now|live game)\b/.test(lower))
    return { type: "live_football" };

  // Today's fixtures
  if (/\b(today.*match|match.*today|football today|games today|fixtures today|who.*playing.*today|today.*football|fixture)\b/.test(lower))
    return { type: "football_today" };

  // Team score search
  const scoreMatch = lower.match(/(?:score|result|last match|latest match|how did|played)\s+(?:of\s+|for\s+)?([a-zA-Z\s]{3,30})/);
  if (scoreMatch) return { type: "team_score", param: scoreMatch[1].trim() };

  // News
  if (/\b(football news|soccer news)\b/.test(lower)) return { type: "news", param: "football" };
  if (/\b(sports news)\b/.test(lower)) return { type: "news", param: "sports" };
  if (/\b(tech news|technology news)\b/.test(lower)) return { type: "news", param: "tech" };
  if (/\b(business news)\b/.test(lower)) return { type: "news", param: "business" };
  if (/\b(world news|latest news|top news|news|headlines|breaking)\b/.test(lower)) return { type: "news", param: "world" };

  // Radio
  if (/\b(radio|listen.*radio|stream|station)\b/.test(lower)) return { type: "radio" };

  // Weather with location
  const weatherMatch = lower.match(/weather\s+(?:in\s+|for\s+)?([a-zA-Z\s]{2,30})/);
  if (weatherMatch) return { type: "weather", param: weatherMatch[1].trim() };
  if (/\bweather\b/.test(lower)) return { type: "weather", param: "London" };

  return { type: "chat" };
}

// ─────────────────────────────────────────
//  AI CHAT
// ─────────────────────────────────────────
async function buildAndChat(userId, userText, contextPrefix) {
  const history = userHistory.get(userId) || [];
  const messageContent = contextPrefix ? `${contextPrefix}\n\nUser said: ${userText}` : userText;
  history.push({ role: "user", content: messageContent });
  if (history.length > 30) history.splice(0, history.length - 30);

  const now = await getLiveTime("UTC");
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: `${SYSTEM_PROMPT}\n\nCurrent date and time (UTC): ${now}` },
      ...history,
    ],
    max_tokens: 1200,
    temperature: 0.82,
  });

  const reply = completion.choices[0]?.message?.content || "Hmm, I'm not sure what to say. Could you rephrase that?";
  history[history.length - 1] = { role: "user", content: userText };
  history.push({ role: "assistant", content: reply });
  userHistory.set(userId, history);
  return reply;
}

// ─────────────────────────────────────────
//  HANDLE TEXT
// ─────────────────────────────────────────
async function handleTextMessage(chatId, userId, text) {
  const intent = detectIntent(text);

  if (intent.type === "time_place") {
    const result = await getTimeForPlace(intent.param);
    if (result) {
      return bot.sendMessage(
        chatId,
        `🕐 The current time in *${intent.param.charAt(0).toUpperCase() + intent.param.slice(1)}* is:\n\n*${result.formatted}*`,
        { parse_mode: "Markdown" }
      );
    }
    // Couldn't find it — let AI handle it naturally
    const reply = await buildAndChat(userId, text, `The user is asking about the time in "${intent.param}". The current UTC time is: ${await getLiveTime("UTC")}. Give them the approximate local time for that location.`);
    return bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
  }

  if (intent.type === "time") {
    const t = await getLiveTime("UTC");
    return bot.sendMessage(chatId, `🕐 The current time (UTC) is:\n\n*${t}*\n\nAsk me "time in Nigeria" or "time in Dubai" for any country's local time!`, { parse_mode: "Markdown" });
  }

  if (intent.type === "live_football") {
    return bot.sendMessage(chatId, await getLiveFootball(), { parse_mode: "Markdown" });
  }

  if (intent.type === "football_today") {
    return bot.sendMessage(chatId, await getFootballToday(), { parse_mode: "Markdown" });
  }

  if (intent.type === "team_score" && intent.param) {
    return bot.sendMessage(chatId, await searchTeamScore(intent.param), { parse_mode: "Markdown" });
  }

  if (intent.type === "news") {
    return bot.sendMessage(chatId, await getNews(intent.param), { parse_mode: "Markdown" });
  }

  if (intent.type === "radio") {
    return bot.sendMessage(chatId, getRadioLinks(), { parse_mode: "Markdown" });
  }

  if (intent.type === "weather" && intent.param) {
    return bot.sendMessage(chatId, await getWeather(intent.param), { parse_mode: "Markdown" });
  }

  const reply = await buildAndChat(userId, text);
  return bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
}

// ─────────────────────────────────────────
//  BOT COMMANDS
// ─────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from?.first_name || "friend";
  await bot.sendMessage(chatId, `Hello, *${firstName}*! You are welcome 👋`, { parse_mode: "Markdown" });
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `Here's everything I can do:\n\n💬 *Chat* — Talk to me about anything, I remember context\n🕐 *Time* — "what time is it in Nigeria?" or "time in Dubai"\n🌤 *Weather* — "weather in Lagos" or "weather in London"\n⚽ *Football* — "who is playing today?" · "live scores" · "score of Arsenal"\n📰 *News* — "latest news" · "football news" · "tech news"\n📻 *Radio* — "show me radio stations"\n🎤 *Voice* — Send a voice note and I'll reply\n📸 *Photos* — Send a picture and I'll tell you what I see\n\n/reset — Start a fresh conversation`,
    { parse_mode: "Markdown" }
  );
});

bot.onText(/\/score (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const teamName = match[1].trim();
  await bot.sendChatAction(chatId, "typing");
  const result = await searchTeamScore(teamName);
  bot.sendMessage(chatId, result, { parse_mode: "Markdown" });
});

bot.onText(/\/reset/, (msg) => {
  if (msg.from?.id) userHistory.delete(msg.from.id);
  bot.sendMessage(msg.chat.id, "All cleared! Fresh start 🔄 What's on your mind?");
});

// ─────────────────────────────────────────
//  INCOMING MESSAGES
// ─────────────────────────────────────────
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return;

  try {
    // Voice / Audio message
    if (msg.voice || msg.audio) {
      await bot.sendChatAction(chatId, "typing");
      const fileId = (msg.voice || msg.audio).file_id;
      const fileInfo = await bot.getFile(fileId);
      const ext = fileInfo.file_path?.endsWith(".ogg") ? "voice.ogg" : "audio.mp3";
      const buffer = await downloadTelegramFile(fileId);
      const transcript = await transcribeVoice(buffer, ext);

      if (!transcript || !transcript.trim()) {
        return bot.sendMessage(chatId, "I heard you but couldn't make out the words clearly. Could you try again or type it out?");
      }
      await bot.sendMessage(chatId, `🎤 I heard: _"${transcript.trim()}"_`, { parse_mode: "Markdown" });
      await bot.sendChatAction(chatId, "typing");
      return handleTextMessage(chatId, userId, transcript.trim());
    }

    // Photo message
    if (msg.photo) {
      await bot.sendChatAction(chatId, "upload_photo");
      const photo = msg.photo[msg.photo.length - 1];
      const buffer = await downloadTelegramFile(photo.file_id);
      await bot.sendChatAction(chatId, "typing");
      const description = await describeImage(buffer);
      const caption = msg.caption || "";

      if (caption) {
        const reply = await buildAndChat(userId, caption, `The user sent an image. Description of the image: ${description}`);
        return bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
      }
      return bot.sendMessage(chatId, `📸 Here's what I see:\n\n${description}`, { parse_mode: "Markdown" });
    }

    // Regular text
    if (msg.text && !msg.text.startsWith("/")) {
      await bot.sendChatAction(chatId, "typing");
      return handleTextMessage(chatId, userId, msg.text);
    }

  } catch (err) {
    console.error("Error handling message:", err?.message || err);
    try {
      bot.sendMessage(chatId, "Something went wrong on my end. Give me a second and try again!");
    } catch {}
  }
});

bot.on("polling_error", (err) => {
  console.error("Polling error:", err?.message || err);
});

console.log("✅ ChatGPT Telegram Bot is running...");
