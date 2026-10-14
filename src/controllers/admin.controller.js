// Controladores de administración
const { getRequestContext } = require('../utils/requestContext');
const adminService = require('../services/admin.service');
const auditService = require('../services/audit.service');

async function listUsers(req, res) {
  const { data, meta } = await adminService.listUsers(req.query);
  res.json({ success: true, data, meta });
}

async function changeRole(req, res) {
  const user = await adminService.changeRole(
    req.params.id,
    req.user.id,
    req.body.role,
    getRequestContext(req)
  );
  res.json({ success: true, data: user });
}

async function auditLogs(req, res) {
  const { data, meta } = await auditService.listLogs(req.query);
  res.json({ success: true, data, meta });
}

async function stats(req, res) {
  const data = await adminService.getStats();
  res.json({ success: true, data });
}

module.exports = { listUsers, changeRole, stats, auditLogs };
