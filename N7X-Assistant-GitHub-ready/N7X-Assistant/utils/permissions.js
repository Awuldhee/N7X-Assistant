function isAdmin(interaction) {
  const roleId = process.env.ADMIN_ROLE_ID;
  if (!roleId) return false;
  return Boolean(interaction.member?.roles?.cache?.has(roleId));
}
function requireAdmin(interaction) {
  if (isAdmin(interaction)) return true;
  const error = new Error("You need the configured admin role to use this command.");
  error.code = "ADMIN_REQUIRED";
  throw error;
}
function currencyName() { return process.env.CURRENCY_NAME || "N7X Points"; }
function validAmount(amount) { return Number.isSafeInteger(amount) && amount > 0; }
module.exports = { isAdmin, requireAdmin, currencyName, validAmount };
