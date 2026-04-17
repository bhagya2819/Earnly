const express = require('express');
const crypto = require('crypto');
const { sendOTP } = require('../services/emailService');

const router = express.Router();

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

const otpStore = new Map();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of otpStore.entries()) {
    if (entry.expiresAt < now) otpStore.delete(key);
  }
}, 60 * 1000).unref?.();

router.post('/send', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const existing = otpStore.get(email);
    if (existing && Date.now() - existing.sentAt < RESEND_COOLDOWN_MS) {
      const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.sentAt)) / 1000);
      return res.status(429).json({ error: 'Please wait before requesting another code', retryAfter });
    }

    const otp = generateOtp();
    otpStore.set(email, {
      hash: hashOtp(otp),
      expiresAt: Date.now() + OTP_TTL_MS,
      sentAt: Date.now(),
      attempts: 0,
    });

    await sendOTP(email, otp);

    res.json({ message: 'OTP sent', expiresInSec: OTP_TTL_MS / 1000 });
  } catch (err) {
    console.error('[OTP] send error:', err.message);
    res.status(500).json({ error: 'Failed to send OTP', details: err.message });
  }
});

router.post('/verify', (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();

    if (!email || !otp) {
      return res.status(400).json({ error: 'email and otp are required' });
    }

    const entry = otpStore.get(email);
    if (!entry) {
      return res.status(400).json({ error: 'No OTP requested for this email' });
    }
    if (entry.expiresAt < Date.now()) {
      otpStore.delete(email);
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }
    if (entry.attempts >= MAX_ATTEMPTS) {
      otpStore.delete(email);
      return res.status(429).json({ error: 'Too many attempts. Please request a new code.' });
    }

    entry.attempts += 1;

    if (hashOtp(otp) !== entry.hash) {
      return res.status(400).json({ error: 'Invalid OTP', attemptsLeft: MAX_ATTEMPTS - entry.attempts });
    }

    otpStore.delete(email);
    res.json({ message: 'OTP verified', verified: true });
  } catch (err) {
    console.error('[OTP] verify error:', err.message);
    res.status(500).json({ error: 'Failed to verify OTP', details: err.message });
  }
});

module.exports = router;
