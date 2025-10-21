const bcrypt = require('bcryptjs');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenHelpers');
const { ApiError } = require('../middleware/errorHandler');
const tenantDBManager = require('../config/tenantDatabase');
const { sendInvitationEmail, sendPasswordResetEmail } = require('./emailService');
const { generateVerificationToken, generatePasswordResetToken } = require('../utils/helpers');

class AuthService {
    // Superadmin only
    async superadminLogin(email, password) {
        const Superadmin = tenantDBManager.masterConnection.model('Superadmin');
        const user = await Superadmin.findOne({ email: email.toLowerCase(), isActive: true }).select('+password');
        if (!user || !(await user.comparePassword(password))) throw new ApiError(401, 'Invalid credentials');
        const token = generateAccessToken({ userId: user._id, email: user.email, role: user.role });
        return { token, user: { id: user._id, email: user.email, role: user.role, name: user.name } };
    }
    // Multi-tenant login
    async userLogin({ tenantId, email, password }) {
        const db = await tenantDBManager.getTenantConnection(tenantId);
        const User = db.model('User');
        const user = await User.findOne({ email: email.toLowerCase(), isActive: true }).select('+password');
        if (!user || !(await user.comparePassword(password))) throw new ApiError(401, 'Invalid credentials');
        if (!user.isEmailVerified) throw new ApiError(403, 'Email not verified');
        const accessToken = generateAccessToken({ userId: user._id, tenantId, email: user.email, role: user.role });
        const refreshToken = generateRefreshToken({ userId: user._id, tenantId, email: user.email, role: user.role });
        return { accessToken, refreshToken, user: { id: user._id, email: user.email, role: user.role, name: user.name } };
    }
    // Accept invitation and register
    async register({ token, name, password }) {
        // Find and validate invitation (in master DB)
        const Invitation = tenantDBManager.masterConnection.model('Invitation');
        const invitation = await Invitation.findValidByToken(token);
        if (!invitation || invitation.isExpired) throw new ApiError(400, 'Invalid/expired invitation');

        // Setup user in tenant DB
        const tenantId = invitation.tenantId.toString();
        const db = await tenantDBManager.getTenantConnection(tenantId);
        const User = db.model('User');

        const hashed = await bcrypt.hash(password, 12);
        const user = await User.create({
            email: invitation.email,
            password: hashed,
            name,
            role: invitation.role,
            isActive: true,
            isEmailVerified: false,
            emailVerificationToken: generateVerificationToken(),
            emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000
        });

        invitation.markAsAccepted(user._id);
        // Email verification link
        // For now, log to console
        const verifyLink = `${config.frontendUrl}/verify-email?token=${user.emailVerificationToken}`;
        await sendInvitationEmail({ to: user.email, org: 'Tenant', invitationUrl: verifyLink });
        return { user: { id: user._id, email: user.email, name: user.name, role: user.role }, verifyLink };
    }
    // Email verification
    async verifyEmail(token, tenantId) {
        const db = await tenantDBManager.getTenantConnection(tenantId);
        const User = db.model('User');
        const user = await User.findOne({ emailVerificationToken: token });
        if (!user) throw new ApiError(400, 'Invalid token');
        if (user.isEmailVerified) return { message: 'Already verified!' };
        user.isEmailVerified = true;
        user.emailVerificationToken = null;
        user.emailVerificationExpires = null;
        await user.save();
        return { message: 'Email verified' };
    }
    // Forgot password (send reset link)
    async forgotPassword({ email, tenantId }) {
        const db = await tenantDBManager.getTenantConnection(tenantId);
        const User = db.model('User');
        const user = await User.findOne({ email });
        if (!user || !user.isActive) return { sent: false };
        user.passwordResetToken = generatePasswordResetToken();
        user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
        await user.save();
        const resetUrl = `${config.frontendUrl}/reset-password?token=${user.passwordResetToken}&tid=${tenantId}`;
        await sendPasswordResetEmail({ to: email, resetUrl });
        return { sent: true, resetUrl };
    }
    // Reset password
    async resetPassword({ token, tenantId, newPassword }) {
        const db = await tenantDBManager.getTenantConnection(tenantId);
        const User = db.model('User');
        const user = await User.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: Date.now() }
        });
        if (!user) throw new ApiError(400, 'Token invalid or expired');
        user.password = await bcrypt.hash(newPassword, 12);
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        await user.save();
        return { message: 'Password reset successful' };
    }
}
module.exports = new AuthService();
