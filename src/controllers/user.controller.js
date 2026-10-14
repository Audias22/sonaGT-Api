// Controladores del usuario autenticado
const { getRequestContext } = require('../utils/requestContext');
const userService = require('../services/user.service');

async function changePlan(req, res) {
  const result = await userService.changePlan(req.user.id, req.body.plan, getRequestContext(req));
  res.json({ success: true, data: result });
}

module.exports = { changePlan };
