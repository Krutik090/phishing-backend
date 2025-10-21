const nodemailer = require('nodemailer');
const config = require('../config/environment');
const logger = require('../config/logger');

const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    auth: {
        user: config.smtp.user,
        pass: config.smtp.password
    }
});

/**
 * Send invitation email
 */
async function sendInvitationEmail({ to, organizationName, invitationUrl }) {
    const info = await transporter.sendMail({
        from: config.smtp.from,
        to,
        subject: `You're invited to join ${organizationName}`,
        html: `<p>You have been invited. Click <a href="${invitationUrl}">here</a> to register.</p>
        <p>This link expires in 7 days.</p>`
    });
    logger.info(`Invitation email sent to ${to} (${info.messageId})`);
    return info;
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail({ to, resetUrl }) {
    const info = await transporter.sendMail({
        from: config.smtp.from,
        to,
        subject: `Password Reset Request`,
        html: `<p>Click <a href="${resetUrl}">here</a> to reset your password.</p>`
    });
    logger.info(`Password reset email sent to ${to} (${info.messageId})`);
    return info;
}

module.exports = { sendInvitationEmail, sendPasswordResetEmail };
