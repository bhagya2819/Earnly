const nodemailer = require('nodemailer');

const FROM_NAME = process.env.SMTP_FROM_NAME || 'Earnly';
const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn('[Email] SMTP_USER / SMTP_PASS not set — emails will fail');
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return cachedTransporter;
}

async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    subject,
    text: text || undefined,
    html,
  });
  return { messageId: info.messageId };
}

function otpEmailTemplate(otp) {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0f172a;padding:32px;color:#e2e8f0;">
    <div style="max-width:480px;margin:0 auto;background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px;">
      <h2 style="margin:0 0 8px;color:#fff;">Verify your email</h2>
      <p style="margin:0 0 24px;color:#94a3b8;">Use this code to complete your Earnly signup. It expires in 10 minutes.</p>
      <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;text-align:center;">
        <span style="font-size:32px;letter-spacing:8px;font-weight:700;color:#10b981;">${otp}</span>
      </div>
      <p style="margin:24px 0 0;color:#64748b;font-size:12px;">If you didn't request this, you can ignore this email.</p>
    </div>
  </div>`;
}

async function sendOTP(to, otp) {
  return sendEmail({
    to,
    subject: `Your Earnly verification code: ${otp}`,
    html: otpEmailTemplate(otp),
    text: `Your Earnly verification code is ${otp}. It expires in 10 minutes.`,
  });
}

const NOTIFICATION_STYLES = {
  claim_approved: { accent: '#10b981', badge: 'Claim Approved', emoji: '✓' },
  claim_rejected: { accent: '#ef4444', badge: 'Claim Rejected', emoji: '✕' },
  claim_review:   { accent: '#f59e0b', badge: 'Under Review',  emoji: '⏳' },
  claim_pending:  { accent: '#3b82f6', badge: 'Claim Submitted', emoji: '📩' },
  default:        { accent: '#10b981', badge: 'Earnly Update', emoji: '•' },
};

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMetadataRows(metadata = {}) {
  const entries = Object.entries(metadata).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  const rows = entries.map(([k, v]) => {
    const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    const value = typeof v === 'number' && /amount|payout|loss/i.test(k)
      ? `INR ${v.toLocaleString('en-IN')}`
      : escapeHtml(String(v));
    return `<tr>
      <td style="padding:8px 0;color:#64748b;font-size:13px;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;color:#e2e8f0;font-size:13px;text-align:right;">${value}</td>
    </tr>`;
  }).join('');
  return `<table style="width:100%;border-collapse:collapse;margin-top:16px;border-top:1px solid #334155;">${rows}</table>`;
}

function notificationTemplate({ type, title, message, metadata }) {
  const style = NOTIFICATION_STYLES[type] || NOTIFICATION_STYLES.default;
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0f172a;padding:32px;color:#e2e8f0;">
    <div style="max-width:520px;margin:0 auto;background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px;">
      <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:${style.accent}22;border:1px solid ${style.accent}55;color:${style.accent};font-size:12px;font-weight:600;letter-spacing:0.5px;">
        ${style.emoji} ${style.badge}
      </div>
      <h2 style="margin:16px 0 8px;color:#fff;font-size:20px;">${escapeHtml(title)}</h2>
      <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.5;">${escapeHtml(message)}</p>
      ${formatMetadataRows(metadata)}
      <p style="margin:24px 0 0;color:#64748b;font-size:12px;">This is an automated notification from Earnly. You can view it in your dashboard anytime.</p>
    </div>
  </div>`;
}

async function sendNotificationEmail(to, { type, title, message, metadata }) {
  return sendEmail({
    to,
    subject: `[Earnly] ${title}`,
    html: notificationTemplate({ type, title, message, metadata }),
    text: `${title}\n\n${message}`,
  });
}

module.exports = { sendEmail, sendOTP, sendNotificationEmail };
