// src/middleware/sanitize.js
/**
 * Custom MongoDB Query Sanitization Middleware
 * Prevents NoSQL injection attacks
 */
const sanitize = (req, res, next) => {
  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;

    Object.keys(obj).forEach((key) => {
      // Remove keys starting with $ or containing .
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
        return;
      }

      // Recursively sanitize nested objects
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (Array.isArray(obj[key])) {
          obj[key] = obj[key].map(item => 
            typeof item === 'object' ? sanitizeObject(item) : item
          );
        } else {
          obj[key] = sanitizeObject(obj[key]);
        }
      }
    });

    return obj;
  };

  // Sanitize body, query, and params
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

module.exports = sanitize;
