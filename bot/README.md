# Hanasand Discord bot

This TypeScript bot provides `/info`, `/ping`, `/help`, and `/tickets`. Its native Discord buttons create private support channels, show linked ticket history, and restore resolved channels. Messages sync with Hanasand over the support WebSocket stream.

## Setup

1. Create a Discord application and bot in the [Discord Developer Portal](https://discord.com/developers/applications). Enable the **Message Content Intent** so staff replies in support channels can be read. Copy the bot token into the server environment; never commit it or paste it into chat.
2. Create or update a Hanasand service account in `/management/service-accounts` with these six scopes:
   - `GET /api/support/tickets`
   - `GET /api/support/tickets/:id/messages`
   - `POST /api/support/tickets/:id/messages`
   - `GET /api/support/discord/tickets`
   - `POST /api/support/discord/action`
   - `GET /api/ws/support`

   The service account may read and reply to human support chats and manage Discord-originated tickets through those endpoints. Add the token it returns to `HANASAND_DISCORD_SUPPORT_API_KEY`.
3. Set `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `HANASAND_DISCORD_SUPPORT_API_KEY`, and `DISCORD_SUPPORT_ROLE_ID` in the Hanasand server's environment. `DISCORD_SUPPORT_ROLE_ID` must identify a least-privileged Support role, and the Hanasand bot plus staff who need access must have that role. New channels are placed in the existing `Support` category or the category identified by `DISCORD_SUPPORT_CATEGORY_ID`. Discord server owners and members with Administrator permission can still bypass channel restrictions.
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

A committed human support message or handoff wakes the bot through PostgreSQL `LISTEN/NOTIFY` -> the website's WebSocket stream -> Discord. Discord messages use the member's server nickname, then global name, then username, and use idempotency keys so reconnects do not duplicate replies. Account linking is optional; linking also makes a Discord ticket available in website history. Resolved channels show their removal timestamp and are removed from Discord 24 hours after resolution; tickets remain on Hanasand and can be restored from `/tickets` history. The bridge does not use a polling interval.
