# N7X-Assistant

Discord bot for managing **N7X Points**, member balances, leaderboards, role-based point operations, marketplace-role conversion, and CSV/Google Sheets data transfers.

Built with Node.js, Discord.js v14, SQLite (`better-sqlite3`), `@napi-rs/canvas`, and Google Sheets API.

## Features

- Store member balances in SQLite, separated by Discord server.
- Award or remove points from individual members, multiple members, or everyone with a selected role.
- Display member balances, leaderboard positions, and a leaderboard image.
- Convert supported marketplace roles into N7X Points.
- Import balances from a CSV attachment or a Google Sheets link.
- Export balances to the configured Google Spreadsheet.
- Assign a role to members who posted in a specified Discord thread.
- Log slash-command activity when a log channel is configured.

## Requirements

- Node.js **20 or newer**
- npm
- A Discord application and bot token
- A Discord server where the bot can be invited
- Google Cloud project and service-account credentials for Google Sheets export
- A Google Spreadsheet shared with the service account as **Editor** for exports

## Installation

1. Download or clone this repository and open the project directory (the directory containing `package.json`).
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

   On Windows, you can copy `.env.example` manually and name the copy `.env`.

4. Fill in the environment variables described below.
5. Invite the bot with the `bot` and `applications.commands` OAuth2 scopes.
6. In the Discord Developer Portal, enable **Server Members Intent** for role-wide operations.
7. Register slash commands:

   ```bash
   npm run deploy
   ```

8. Start the bot:

   ```bash
   npm start
   ```

For guild-specific command registration during testing, set `GUILD_ID`. If `GUILD_ID` is omitted, commands are registered globally and may take longer to appear.

## Environment variables

Create a private `.env` file in the project root. Never commit it to GitHub.

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Bot token from the Discord Developer Portal. |
| `CLIENT_ID` | Yes | Discord application ID. |
| `GUILD_ID` | Recommended | Discord server ID for guild-specific slash-command registration. |
| `ADMIN_ROLE_ID` | Yes | Role ID authorized to use administrative commands. |
| `CURRENCY_NAME` | No | Currency label displayed by the bot. Set to `N7X Points`. |
| `TOP_LIMIT` | No | Default number of leaderboard entries. |
| `LOG_CHANNEL_ID` | No | Channel ID used for slash-command activity logs. |
| `BOT_COMMANDS_CHANNEL_ID` | No | Channel ID where member balance and leaderboard commands are available. |
| `CONVERT_PANEL_CHANNEL_ID` | No | Channel ID where the Engage Points conversion panel is posted. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Yes for Google Sheets export | Path to the Google service-account JSON key file. |
| `N7X_SPREADSHEET_ID` | Yes for Google Sheets export | ID of the dedicated N7X-Assistant Google Spreadsheet used by `/export_data_csv`. |

### Google Sheets setup

1. Enable the Google Sheets API in your Google Cloud project.
2. Configure `GOOGLE_SERVICE_ACCOUNT_JSON` with the path to your service-account JSON key file.
3. Create a dedicated Google Spreadsheet for N7X-Assistant.
4. Share the spreadsheet with the service-account email and grant **Editor** access.
5. Set `N7X_SPREADSHEET_ID` to the ID of that spreadsheet.
6. Ensure `commands/export_data_csv.js` reads the destination using `process.env.N7X_SPREADSHEET_ID`.

Example spreadsheet URL:

`https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit`

The spreadsheet ID is the value between `/d/` and `/edit`.

### Example `.env`

```env
DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN
CLIENT_ID=YOUR_DISCORD_APPLICATION_ID
GUILD_ID=YOUR_DISCORD_SERVER_ID

ADMIN_ROLE_ID=YOUR_ADMIN_ROLE_ID
CURRENCY_NAME=N7X Points
TOP_LIMIT=10

LOG_CHANNEL_ID=YOUR_LOG_CHANNEL_ID
BOT_COMMANDS_CHANNEL_ID=YOUR_COMMANDS_CHANNEL_ID
CONVERT_PANEL_CHANNEL_ID=YOUR_CONVERSION_PANEL_CHANNEL_ID

GOOGLE_SERVICE_ACCOUNT_JSON=./google-service-account.json
N7X_SPREADSHEET_ID=YOUR_N7X_SPREADSHEET_ID
```

**Important:** Keep the N7X spreadsheet separate from the Incentiv-Assistant spreadsheet to prevent data from being mixed. Never upload `.env` or `google-service-account.json` to GitHub.

## Commands

### Member commands

| Command | Function | Notes |
|---|---|---|
| `/my_balance` | Shows your current N7X Points balance and rank. | Response is private/ephemeral. |
| `/leaderboard_position` | Shows your leaderboard position and nearby ranks. | Use in the configured bot-commands channel. |
| `/top [limit]` | Displays the top balances as a leaderboard image. | `limit` is optional and supports 3–10 entries. Use in the configured bot-commands channel. |
| `/convert` | Converts supported marketplace roles held by you into N7X Points. | Conversion removes the matching roles and is final. |

### Administrative commands

Administrative commands are restricted to members with the configured `ADMIN_ROLE_ID`.

| Command | Options | Function |
|---|---|---|
| `/give` | `user`, `amount` | Adds points to one member. |
| `/give_multi` | `users`, `amount` | Adds the same amount to each unique member mentioned or identified in `users`. Separate users with spaces or commas. |
| `/give_role_points` | `role`, `amount` | Adds the specified amount to every non-bot member with the selected role. |
| `/remove` | `user`, `amount` | Removes points from one member, subject to the command's balance validation. |
| `/remove_multi` | `users`, `amount` | Removes the same amount from each unique member listed. A member is skipped if their balance is insufficient. |
| `/remove_role_points` | `role`, `amount` | Removes up to the requested amount from each non-bot member with the selected role. Members with zero balance are skipped; balances do not become negative. |
| `/admin_check` | `user` | Checks a member's current balance and leaderboard rank. |
| `/upload_csv` | `file` or `url` | Imports balances from a CSV attachment or Google Sheets URL. |
| `/export_data_csv` | None | Exports balances for the current server to the spreadsheet ID configured in `commands/export_data_csv.js`. |
| `/assign_roles_from_thread_authors` | `thread_id`, `role` | Scans a thread's messages and assigns the selected role to members who posted there. Produces a CSV summary attachment. |

## Engage Points Conversion

N7X-Assistant allows members to convert their **Engage Points into Engage X Points** through the conversion panel provided in the Discord server.

The conversion panel is automatically posted in the channel configured by `CONVERT_PANEL_CHANNEL_ID`. Members only need to click the available panel button to start the conversion process.

| Supported Role | Points Credited |
|---|---:|
| `N7X Points 3` | 3 |
| `N7X Points 15` | 15 |
| `N7X Points 30` | 30 |
| `N7X Points 75` | 75 |
| `N7X Points 150` | 150 |

The bot checks the member's eligible roles, converts the corresponding values into N7X Points, and removes the converted roles after successful processing.

**Important:** Members do not need to run any slash command. All conversions are initiated through the available panel.

## CSV import format

The CSV file must include the following headers:

```csv
user_id,balance
123456789012345678,100
234567890123456789,250
```

- `user_id` must be the exact Discord ID as a string of 17–20 digits.
- `balance` must be a non-negative whole number.
- Duplicate user IDs are rejected.
- Negative-balance rows are skipped and reported by the importer.
- Blank lines are ignored.
- Importing updates the records present in the CSV; members absent from the file are not automatically deleted from the database.
- Keep Discord IDs as text in spreadsheet software. Do not allow Excel to convert IDs into scientific notation or round their digits.

## Permissions and Discord setup

The bot needs the following permissions, as applicable to the enabled features:

- View Channels
- Send Messages
- Embed Links
- Attach Files
- Read Message History (for checking whether the conversion panel already exists and for reading thread messages)
- Manage Roles (for role conversion and assigning roles to thread authors)

The bot's highest role must be above any role it needs to remove or assign. Enable **Server Members Intent** in the Developer Portal for role-wide operations.

## Data storage

- Balances are stored locally in SQLite under the `database/` directory.
- Keep the database file when updating the bot; deleting it may erase stored balances.
- The database is separate from Google Sheets. Exporting writes the current server's balances to the destination spreadsheet; importing updates the database from the selected CSV/Sheet source.
- Back up the database file before performing major imports or maintenance.

## Project scripts

```bash
npm run deploy  # Register slash commands with Discord
npm start       # Start the bot
```

After adding, removing, or changing slash commands, run `npm run deploy` again.

## Security

Before publishing this project on GitHub:

- Never commit `.env`.
- Never commit `google-service-account.json` or any other credential/private key.
- Do not upload SQLite database files containing member data.
- Keep bot tokens and service-account credentials private.
- If a credential has already been committed or exposed, revoke/rotate it.

A `.gitignore` should include at least:

```gitignore
.env
google-service-account.json
*.sqlite
*.sqlite3
node_modules/
```

## License

No license has been specified yet. Add a license file before presenting this repository as open source.
