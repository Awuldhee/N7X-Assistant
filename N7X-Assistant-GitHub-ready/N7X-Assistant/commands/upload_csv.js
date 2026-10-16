const { SlashCommandBuilder } = require('discord.js');
const { requireAdmin } = require('../utils/permissions');
const { db, setBalance } = require('../database/database');

function parseCsvLine(line) {
  const fields = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      fields.push(value);
      value = '';
    } else {
      value += char;
    }
  }

  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  fields.push(value);
  return fields;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (!lines.length || !lines[0].trim()) {
    throw new Error('CSV must contain a header row.');
  }

  const headers = parseCsvLine(lines[0]).map(header => header.trim().toLowerCase());
  const userIndex = headers.indexOf('user_id');
  const balanceIndex = headers.indexOf('balance');

  if (userIndex < 0 || balanceIndex < 0) {
    throw new Error('CSV must include the columns user_id and balance.');
  }

  const records = [];
  const skippedNegativeRows = [];
  const seenIds = new Set();

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const fields = parseCsvLine(lines[i]);
    let userId = (fields[userIndex] || '').trim();
    let rawBalance = (fields[balanceIndex] || '').trim();

    // Skip completely empty rows, but do not silently ignore partially filled records.
    if (!userId && !rawBalance) continue;

    // Accept Excel text values such as ="123456789012345678".
    const excelTextMatch = userId.match(/^="(\d{17,20})"$/);
    if (excelTextMatch) userId = excelTextMatch[1];

    if (!/^\d{17,20}$/.test(userId)) {
      throw new Error(
        `Invalid Discord user_id on CSV row ${i + 1}: "${userId}". ` +
        'The ID must contain exactly 17–20 digits.'
      );
    }

    // Negative balances cannot exist in N7X-Assistant. Skip these rows and report them.
    if (/^-\d+$/.test(rawBalance)) {
      skippedNegativeRows.push({ row: i + 1, userId, balance: rawBalance });
      continue;
    }

    // Accept whole numbers with standard thousands separators, e.g. 12,719.
    if (/^\d{1,3}(,\d{3})+$/.test(rawBalance)) {
      rawBalance = rawBalance.replace(/,/g, '');
    }

    if (!/^\d+$/.test(rawBalance)) {
      throw new Error(
        `Invalid balance on CSV row ${i + 1}: "${fields[balanceIndex]}". ` +
        'Balance must be a non-negative whole number.'
      );
    }

    const balance = Number(rawBalance);
    if (!Number.isSafeInteger(balance) || balance < 0) {
      throw new Error(`Balance on CSV row ${i + 1} is too large or invalid.`);
    }

    if (seenIds.has(userId)) {
      throw new Error(`CSV contains duplicate user_id on row ${i + 1}: ${userId}.`);
    }

    seenIds.add(userId);
    records.push({ userId, balance });
  }

  if (!records.length && !skippedNegativeRows.length) {
    throw new Error('No data rows found in CSV.');
  }

  return { records, skippedNegativeRows };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('upload_csv')
    .setDescription('Import user balances from a CSV file or Google Sheets URL (admin only)')
    .addAttachmentOption(option =>
      option
        .setName('file')
        .setDescription('CSV file with user_id and balance columns')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('url')
        .setDescription('Google Sheets link shared as Anyone with the link - Viewer')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (requireAdmin(interaction) === false) return;

    const attachment = interaction.options.getAttachment('file');
    const sheetUrl = interaction.options.getString('url');

    if ((!attachment && !sheetUrl) || (attachment && sheetUrl)) {
      return interaction.reply({
        content: 'Provide exactly one input: either `file` (CSV attachment) or `url` (Google Sheets link).',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      let text;

      if (attachment) {
        if (!attachment.name.toLowerCase().endsWith('.csv')) {
          return interaction.editReply('Please upload a `.csv` file.');
        }
        if (attachment.size > 8 * 1024 * 1024) {
          return interaction.editReply('CSV is too large. Maximum file size is 8 MB.');
        }

        const response = await fetch(attachment.url);
        if (!response.ok) {
          throw new Error(`Could not download CSV attachment (HTTP ${response.status}).`);
        }
        text = await response.text();
      } else {
        let parsedUrl;
        try {
          parsedUrl = new URL(sheetUrl);
        } catch {
          return interaction.editReply('The URL is invalid. Provide a Google Sheets link.');
        }

        const match = parsedUrl.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
        if (parsedUrl.hostname !== 'docs.google.com' || !match) {
          return interaction.editReply(
            'Please provide a valid Google Sheets URL from `docs.google.com/spreadsheets/d/...`.'
          );
        }

        const sheetId = match[1];
        const gid = parsedUrl.searchParams.get('gid') ||
          new URLSearchParams(parsedUrl.hash.slice(1)).get('gid') || '0';
        const exportUrl =
          `https://docs.google.com/spreadsheets/d/${sheetId}/export` +
          `?format=csv&gid=${encodeURIComponent(gid)}`;
        const response = await fetch(exportUrl, { redirect: 'follow' });

        if (!response.ok) {
          throw new Error(
            `Google Sheets could not be downloaded (HTTP ${response.status}). ` +
            'Check that access is set to Anyone with the link - Viewer.'
          );
        }

        text = await response.text();
        if (/<html[\s>]/i.test(text) || /<!DOCTYPE html/i.test(text)) {
          throw new Error(
            'Google Sheets returned a web page instead of CSV. Set General access to ' +
            'Anyone with the link - Viewer and try again.'
          );
        }
      }

      const { records, skippedNegativeRows } = parseCsv(text);
      if (!records.length) {
        return interaction.editReply(
          `No balances were imported. ${skippedNegativeRows.length} row(s) had negative balances and were skipped.`
        );
      }

      // Validate the whole input before changing balances; apply accepted records atomically.
      const importRows = db.transaction((guildId, rows) => {
        for (const row of rows) setBalance(guildId, row.userId, row.balance);
      });
      importRows(interaction.guildId, records);

      let result =
        `Import completed. **${records.length}** user balances were imported or updated. ` +
        'Users not listed were left unchanged.';
      if (skippedNegativeRows.length) {
        result += `\n\n**Skipped:** ${skippedNegativeRows.length} row(s) with negative balances. ` +
          'Negative balances were not imported; those users retain their existing balances.';
        result += `\nFirst skipped row: ${skippedNegativeRows[0].row} (balance ${skippedNegativeRows[0].balance}).`;
      }
      result += '\n\nEnsure `user_id` contains the original full Discord IDs and is formatted as Plain text.';

      await interaction.editReply(result);
    } catch (error) {
      console.error('[upload_csv] Import failed:', error);
      await interaction.editReply(`Import failed: ${error.message || 'Unexpected error.'}`);
    }
  }
};
