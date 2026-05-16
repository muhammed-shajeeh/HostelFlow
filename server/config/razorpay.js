const Razorpay = require('razorpay');

const keyId = process.env.RAZORPAY_KEY_ID || 'mock_key_id';
const keySecret = process.env.RAZORPAY_KEY_SECRET || 'mock_key_secret';

if (keyId === 'mock_key_id' || keySecret === 'mock_key_secret') {
  console.warn('[RAZORPAY CONFIG WARNING] Secure credentials missing. Utilizing sandbox placeholder configurations.');
}

const razorpayInstance = new Razorpay({
  key_id: keyId,
  key_secret: keySecret
});

module.exports = razorpayInstance;
