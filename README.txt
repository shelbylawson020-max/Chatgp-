============================================
  CHATGPT TELEGRAM BOT — SETUP GUIDE
============================================

WHAT THIS BOT CAN DO:
  💬 Chat naturally like a real human friend
  🕐 Exact time for ANY country or city
      e.g. "time in Nigeria" / "time in Dubai"
  🌤 Live weather for any city
  ⚽ Live football scores & today's fixtures
  🔍 Team score search — /score Arsenal
  📰 Live news (world, football, tech, sports)
  📻 Radio station stream links
  🎤 Understands voice messages
  📸 Sees and describes your photos

--------------------------------------------
  STEP 1 — ADD YOUR SECRET KEYS
--------------------------------------------

1. Find the file called ".env.example"
2. Rename it to ".env"  (remove the word "example")
3. Open it and fill in your two keys:

   TELEGRAM_BOT_TOKEN=paste_your_bot_token_here
   GROQ_API_KEY=paste_your_groq_api_key_here

   Get your FREE Groq key at:
   https://console.groq.com/keys

--------------------------------------------
  STEP 2 — DEPLOY TO RAILWAY (FREE, 24/7)
--------------------------------------------

Railway gives $5 free credit per month.
A Telegram bot uses almost none of that.
It runs 24/7 — no sleeping, no closing apps.

1. Go to https://github.com/signup
   Create a free GitHub account

2. Go to https://github.com/new
   Create a new repo called: my-telegram-bot
   Make it Public → click Create Repository

3. On the next screen click:
   "uploading an existing file"
   Drag ALL files from this folder into it
   Click "Commit changes"

4. Go to https://railway.app
   Click "Login" → "Login with GitHub"

5. Click "New Project"
   → "Deploy from GitHub repo"
   → Pick "my-telegram-bot"

6. After it loads, click "Variables" tab
   Add these two variables:
     TELEGRAM_BOT_TOKEN = (your bot token)
     GROQ_API_KEY       = (your Groq key)

7. Click "Deploy" — done!
   In about 2 minutes your bot is live 24/7.

--------------------------------------------
  COMMANDS YOU CAN USE:
--------------------------------------------

  /start  — Welcome message + today's football
  /help   — List all features
  /score Arsenal — Latest result for any team
  /reset  — Clear conversation history

  Just type naturally, for example:
  • "What time is it in Nigeria?"
  • "Time in New York"
  • "Weather in Dubai"
  • "Who is playing today?"
  • "Live scores"
  • "Score of Chelsea"
  • "Latest news"
  • "Football news"
  • "Tech news"
  • "Show me radio stations"
  • Send a voice note → it replies to you
  • Send a photo → it describes what it sees

--------------------------------------------
  IMPORTANT LINKS
--------------------------------------------

  Telegram BotFather : https://t.me/BotFather
  Groq API keys      : https://console.groq.com/keys
  GitHub signup      : https://github.com/signup
  Railway hosting    : https://railway.app

============================================
