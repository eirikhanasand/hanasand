# Hanasand Discord bot

This TypeScript bot provides `/info`, `/ping`, and `/help`, and mirrors human Hanasand support chats into private Discord channels. It uses the website's support change stream over WebSocket and its scoped support API for messages. It does not poll the site.

## Setup

1. Create a Discord application and bot in the [Discord Developer Portal](https://discord.com/developers/applications). Enable the **Message Content Intent** so staff replies in support channels can be read. Copy the bot token into the server environment; never commit it or paste it into chat.
2. Create a Hanasand service account in `/management/service-accounts` with these four scopes:
   - `GET /api/support/tickets`
   - `GET /api/support/tickets/:id/messages`
   - `POST /api/support/tickets/:id/messages`
   - `GET /api/ws/support`

   The service account may read human support chats and send replies only through those endpoints. Add the token it returns to `HANASAND_DISCORD_SUPPORT_API_KEY`.
3. Set `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, and `HANASAND_DISCORD_SUPPORT_API_KEY` in the Hanasand server's environment. Optionally set `DISCORD_SUPPORT_ROLE_ID`; without it, only the server owner and administrators can see and reply in ticket channels. New channels use the existing `Support` category when present, or `DISCORD_SUPPORT_CATEGORY_ID` when explicitly configured.
4. Register the guild commands and create the server invite link:

   ```sh
   cd bot
   npm ci
   npm run deploy:commands
   npm run invite:url
   ```

   Open the printed link and authorize the bot in the configured server. The invite requests only view channels, send messages, read message history, embed links, manage channels, and manage channel permissions.
5. Start the service on the Hanasand host:

   ```sh
   docker compose --profile discord up -d --build discord-bot
   ```

   The bot stores Discord channel mappings and message de-duplication state in the `discord_bot_state` volume.

For local development, copy `.env.example` to `.env` and use `npm run dev`. The minimum supported Node.js version is 24.17, as required by current discord.js.

## Delivery behavior

A committed human support message or handoff wakes the bot through PostgreSQL `LISTEN/NOTIFY` -> the website's WebSocket stream -> Discord. A Discord staff message is posted to the website support API immediately and uses an idempotency key, so reconnects do not duplicate replies. Network or service failures can still take time to recover; no cross-network system can guarantee literal zero latency or availability. The bridge does not use a polling interval.
