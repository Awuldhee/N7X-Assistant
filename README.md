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

Create a private `.env` file in the project root. Do not commit it.

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Bot token from the Discord Developer Portal. |
| `CLIENT_ID` | Yes | Discord application ID. |
| `GUILD_ID` | Recommended for testing | Server ID for guild-specific slash-command registration. Leave out or empty for global registration. |
| `ADMIN_ROLE_ID` | Yes | Role ID authorized to use administrative commands. The current default in `.env.example` is `1119971731935862854`. |
| `CURRENCY_NAME` | No | Currency label shown in bot responses. Use `N7X Points`. |
| `TOP_LIMIT` | No | Default number of entries for `/top`; the command supports up to 10. |
| `LOG_CHANNEL_ID` | No | Text channel ID used for slash-command activity logs. |
| `BOT_COMMANDS_CHANNEL_ID` | No | Channel where `/top`, `/leaderboard_position`, and `/my_balance` can be used. If omitted, the current default is `1558332206114406400`. |
| `CONVERT_PANEL_CHANNEL_ID` | No | Channel where the conversion panel is posted. If omitted, the current default is `1558349020991193198`. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Required for Google Sheets export | Path to the Google service-account JSON key file, for example `./google-service-account.json`. |

### Google Sheets setup

1. Enable the **Google Sheets API** in the Google Cloud project used by the service account.
2. Put the service-account JSON key in the project directory, or set `GOOGLE_SERVICE_ACCOUNT_JSON` to its path.
3. Share the destination spreadsheet with the service-account email and grant **Editor** access.
4. Keep the service-account JSON key private; never commit it to GitHub.

**Important:** In the current source version, `commands/export_data_csv.js` contains a spreadsheet ID directly in the code. Verify and change that ID to the intended N7X spreadsheet before running `/export_data_csv`. Do not point it at the Incentiv-Assistant spreadsheet unless that is explicitly intended. The source should be changed to read a dedicated environment variable such as `N7X_SPREADSHEET_ID` before this variable is documented as active configuration.

`/upload_csv` is a separate import function. It accepts a CSV attachment or a Google Sheets URL that is accessible to the bot's importer. Keep the source spreadsheet separate from the N7X export destination when the datasets must remain isolated.

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

### Marketplace role conversion

The conversion button panel is posted automatically to the channel configured by `CONVERT_PANEL_CHANNEL_ID`. Members can use the button or `/convert` to convert supported roles:

| Role name | Points credited |
|---|---:|
| `N7X Points 3` | 3 |
| `N7X Points 15` | 15 |
| `N7X Points 30` | 30 |
| `N7X Points 75` | 75 |
| `N7X Points 150` | 150 |

Only supported roles held by the member are converted. The bot removes the converted roles and credits the total points. Members should verify the role list before confirming because conversion is final.

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
