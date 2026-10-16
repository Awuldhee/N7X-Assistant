const { createCanvas } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const { currencyName } = require('./permissions');

async function createLeaderboardImage({ title = 'Leaderboard', rows, guild, highlightUserId = null, emptyText = 'No balances yet', subtitle = null }) {
  const width = 600;
  const headerHeight = subtitle ? 105 : 80;
  const rowHeight = 54;
  const paddingBottom = 18;
  const height = headerHeight + Math.max(1, rows.length) * rowHeight + paddingBottom;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#202020';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 25px Arial';
  ctx.fillText(title, width / 2, 38);
  if (subtitle) {
    ctx.fillStyle = '#bdbdbd';
    ctx.font = '15px Arial';
    ctx.fillText(subtitle, width / 2, 64);
  }

  if (!rows.length) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(emptyText, width / 2, headerHeight + 35);
  }

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const y = headerHeight + idx * rowHeight;
    const highlighted = row.user_id === highlightUserId;
    ctx.fillStyle = highlighted ? '#343022' : (idx % 2 === 0 ? '#242424' : '#202020');
    ctx.beginPath();
    ctx.roundRect(14, y, width - 28, rowHeight - 4, 8);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px Arial';
    ctx.fillText(`${row.rank ?? idx + 1}.`, 28, y + 30);

    let name = row.name || `User ${row.user_id}`;
    while (ctx.measureText(name).width > 330 && name.length > 4) name = `${name.slice(0, -4)}...`;
    ctx.fillStyle = highlighted ? '#ffd43b' : '#f5f5f5';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(name, 76, y + 30);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#f5f5f5';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(Number(row.balance).toLocaleString('en-US'), width - 28, y + 30);
  }

  return new AttachmentBuilder(await canvas.encode('png'), { name: 'incentiv-leaderboard.png' });
}

async function addMemberNames(rows, guild) {
  return Promise.all(rows.map(async (row) => {
    let name = `User ${row.user_id}`;
    try {
      const member = await guild.members.fetch(row.user_id);
      name = member.displayName;
    } catch {}
    return { ...row, name };
  }));
}

module.exports = { createLeaderboardImage, addMemberNames };
