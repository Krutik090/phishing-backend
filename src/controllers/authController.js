const authService = require('../services/authService');
const { setTokenCookies, clearTokenCookies } = require('../utils/tokenHelpers');

exports.superadminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { token, user } = await authService.superadminLogin(email, password);
    setTokenCookies(res, token);
    res.json({ success: true, user, token });
  } catch (err) { next(err); }
};

exports.userLogin = async (req, res, next) => {
  try {
    const { tenantId, email, password } = req.body;
    const { accessToken, refreshToken, user } = await authService.userLogin({ tenantId, email, password });
    setTokenCookies(res, accessToken, refreshToken);
    res.json({ success: true, user, accessToken });
  } catch (err) { next(err); }
};

exports.register = async (req, res, next) => {
  try {
    const { token, name, password } = req.body;
    const out = await authService.register({ token, name, password });
    res.json({ success: true, user: out.user, verifyLink: out.verifyLink });
  } catch (err) { next(err); }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const { token, tenantId } = req.body;
    const out = await authService.verifyEmail(token, tenantId);
    res.json({ success: true, ...out });
  } catch (err) { next(err); }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email, tenantId } = req.body;
    const out = await authService.forgotPassword({ email, tenantId });
    res.json({ success: true, ...out });
  } catch (err) { next(err); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, tenantId, newPassword } = req.body;
    const out = await authService.resetPassword({ token, tenantId, newPassword });
    res.json({ success: true, ...out });
  } catch (err) { next(err); }
};
