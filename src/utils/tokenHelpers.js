const jwt = require('jsonwebtoken');
const config = require('../config/environment');

function generateAccessToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}
function generateRefreshToken(payload) {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn });
}
function setTokenCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.nodeEnv === 'production',
    maxAge: 60 * 60 * 1000,
  });
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.nodeEnv === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
function clearTokenCookies(res) {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
}
module.exports = {
  generateAccessToken, generateRefreshToken, setTokenCookies, clearTokenCookies
};
