const { SlashCommandBuilder } = require('discord.js');
const { requireAdmin } = require('../utils/permissions');
const { db } = require('../database/database');
const path = require('node:path');
const { google } = require('googleapis');

// The export destination is configured separately for N7X-Assistant.
const EXPORT_SPREADSHEET_ID = process.env.N7X_SPREADSHEET_ID;
const EXPORT_RANGE = 'A:B';

function getGoogleAuth() {
  const configuredPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!configuredPath) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not configured in .env.');
  }

  const keyFile = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);

  return new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('export_data_csv')
    .setDescription('Export all user balances to the configured main Google Sheet'),

  async execute(interaction) {
    if (requireAdmin(interaction) === false) return;
    await interaction.deferReply({ ephemeral: true });

    try {
      if (!EXPORT_SPREADSHEET_ID) {
        throw new Error('N7X_SPREADSHEET_ID is not configured in .env.');
      }

      const rows = db.prepare(
        'SELECT user_id, balance FROM balances WHERE guild_id = ? ORDER BY balance DESC, user_id ASC'
      ).all(interaction.guildId);

      // Keep Discord IDs as strings so Google Sheets stores their exact digits.
      const values = [['user_id', 'balance']];
      for (const row of rows) {
        values.push([String(row.user_id), String(row.balance)]);
      }

      const auth = getGoogleAuth();
      const sheets = google.sheets({ version: 'v4', auth });

      // Clear old values first so records removed from the database do not remain in the sheet.
      await sheets.spreadsheets.values.clear({
        spreadsheetId: EXPORT_SPREADSHEET_ID,
        range: EXPORT_RANGE
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: EXPORT_SPREADSHEET_ID,
        range: 'A1:B' + values.length,
        valueInputOption: 'RAW',
        requestBody: { values }
      });

      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${EXPORT_SPREADSHEET_ID}/edit`;
      await interaction.editReply({
        content:
          `Google Sheets export completed. **${rows.length}** user records were written to the main spreadsheet.\n` +
          `${spreadsheetUrl}\n\n` +
          'The sheet now contains the columns `user_id` and `balance`. User IDs are written as text.'
      });
    } catch (error) {
      console.error('[export_data_csv] Google Sheets export failed:', error.response?.data || error);
      await interaction.editReply(
        `Google Sheets export failed: ${error.response?.data?.error?.message || error.message}\n\n` +
        'Confirm that Google Sheets API is enabled and the Service Account has Editor access to the main spreadsheet.'
      );
    }
  }
};
