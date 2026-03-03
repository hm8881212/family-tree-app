import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"Family Tree" <${process.env.SMTP_USER}>`;

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const url = `${process.env.FRONTEND_URL}/verify-email/${token}`;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Verify your email - Family Tree',
    html: `<p>Click to verify your email: <a href="${url}">${url}</a></p><p>Expires in 24 hours.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const url = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Reset your password - Family Tree',
    html: `<p>Click to reset your password: <a href="${url}">${url}</a></p><p>Expires in 1 hour.</p>`,
  });
}

export async function sendInviteEmail(to: string, token: string, familyName: string): Promise<void> {
  const url = `${process.env.FRONTEND_URL}/register?invite=${token}`;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `You're invited to join ${familyName} - Family Tree`,
    html: `<p>You've been invited to join the <strong>${familyName}</strong> family tree.</p><p><a href="${url}">Accept Invitation</a></p><p>This invite expires in 7 days.</p>`,
  });
}

export async function sendJoinRequestEmail(adminEmail: string, familyName: string, requesterEmail: string): Promise<void> {
  await transporter.sendMail({
    from: FROM,
    to: adminEmail,
    subject: `New join request for ${familyName} - Family Tree`,
    html: `<p><strong>${requesterEmail}</strong> has requested to join <strong>${familyName}</strong>.</p><p>Log in to approve or reject this request.</p>`,
  });
}
