const jwt = require('jsonwebtoken');
const config = require('../config/environment');
const tenantDBManager = require('../config/tenantDatabase');
const { ApiError } = require('./errorHandler');

function getToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }
  return req.cookies?.accessToken || null;
}

const authenticate = async (req, res, next) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'No authentication token');
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded; // { userId, tenantId, role, etc }
    if (decoded.tenantId && decoded.role !== 'superadmin') {
      req.db = await tenantDBManager.getTenantConnection(decoded.tenantId);
      req.tenantId = decoded.tenantId;
    }
    next();
  } catch (err) {
    next(new ApiError(401, 'Not authenticated'));
  }
};
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || (Array.isArray(roles) ? !roles.includes(req.user.role) : req.user.role !== roles)) {
      throw new ApiError(403, 'Insufficient privileges');
    }
    next();
  };
};
module.exports = { authenticate, requireRole };
