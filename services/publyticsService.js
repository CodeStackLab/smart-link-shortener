/**
 * Publytics Service (Local Stub)
 * All remote external API calls removed to maximize shortener performance and eliminate latency.
 */
const db = require('../db');

function getConfig() {
  const settings = db.getSettings();
  return {
    configured: true,
    loginEmail: settings.publyticsLoginEmail || '',
    loginPassword: settings.publyticsLoginPassword || '',
    adminAlertMessage: settings.adminAlertMessage || ''
  };
}

async function updateConfig({ loginEmail, loginPassword, adminAlertMessage } = {}) {
  const updates = {};
  if (loginEmail !== undefined) updates.publyticsLoginEmail = String(loginEmail || '').trim();
  if (loginPassword !== undefined) updates.publyticsLoginPassword = String(loginPassword || '').trim();
  if (adminAlertMessage !== undefined) updates.adminAlertMessage = String(adminAlertMessage || '').trim();
  db.updateSettings(updates);
  return { success: true, ...getConfig() };
}

function deleteSite() {
  return { success: true, sitesList: [] };
}

async function testConnection() {
  return { success: true, message: 'Local verification active.' };
}

async function getSites() {
  return [];
}

async function getRealtime() {
  return { visitors: 0, pages: [], referrers: [], countries: [] };
}

async function getOverview() {
  return { visitors: 0, pageviews: 0, bounceRate: 0, duration: 0 };
}

async function getDimension() {
  return [];
}

async function getUsers() {
  return [];
}

async function getUserDetails() {
  return {};
}

module.exports = {
  getConfig,
  updateConfig,
  deleteSite,
  testConnection,
  getSites,
  getRealtime,
  getOverview,
  getDimension,
  getUsers,
  getUserDetails
};
