// src/utils/helpers.js
const crypto = require('crypto');
const mongoose = require('mongoose');

/**
 * Generate unique tenant ID
 * @returns {String} Unique tenant ID (MongoDB ObjectId as string)
 */
const generateTenantId = () => {
    return new mongoose.Types.ObjectId().toString();
};

/**
 * Generate secure random token
 * @param {Number} length - Token length in bytes (default: 32)
 * @returns {String} Hex token
 */
const generateSecureToken = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate invitation token
 * @returns {String} Unique invitation token
 */
const generateInvitationToken = () => {
    return generateSecureToken(32);
};

/**
 * Generate email verification token
 * @returns {String} Unique verification token
 */
const generateVerificationToken = () => {
    return generateSecureToken(32);
};

/**
 * Generate password reset token
 * @returns {String} Unique password reset token
 */
const generatePasswordResetToken = () => {
    return generateSecureToken(32);
};

/**
 * Validate subdomain format
 * @param {String} subdomain - Subdomain to validate
 * @returns {Boolean} Is valid
 */
const isValidSubdomain = (subdomain) => {
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
    return subdomainRegex.test(subdomain);
};

/**
 * Sanitize subdomain
 * @param {String} subdomain - Raw subdomain
 * @returns {String} Sanitized subdomain
 */
const sanitizeSubdomain = (subdomain) => {
    return subdomain
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .substring(0, 63);
};

/**
 * Generate database name from tenant ID
 * @param {String} tenantId - Tenant ID
 * @returns {String} Database name
 */
const generateDatabaseName = (tenantId) => {
    return `tenant_${tenantId}`;
};

/**
 * Hash data using SHA256
 * @param {String} data - Data to hash
 * @returns {String} Hashed data
 */
const hashData = (data) => {
    return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Check if email domain is allowed
 * @param {String} email - Email address
 * @param {Array} allowedDomains - Array of allowed domains
 * @returns {Boolean} Is allowed
 */
const isEmailDomainAllowed = (email, allowedDomains = []) => {
    if (allowedDomains.length === 0) return true;
    
    const domain = email.split('@')[1];
    return allowedDomains.includes(domain);
};

/**
 * Format error for API response
 * @param {Error} error - Error object
 * @returns {Object} Formatted error
 */
const formatError = (error) => {
    return {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR',
        statusCode: error.statusCode || 500,
    };
};

/**
 * Sleep/delay function
 * @param {Number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

module.exports = {
    generateTenantId,
    generateSecureToken,
    generateInvitationToken,
    generateVerificationToken,
    generatePasswordResetToken,
    isValidSubdomain,
    sanitizeSubdomain,
    generateDatabaseName,
    hashData,
    isEmailDomainAllowed,
    formatError,
    sleep,
};
