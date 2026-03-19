const nodemailer = require("nodemailer");

const getTransporter = () => nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendStockRequestEmail = async ({ storeName, totalItems, pendingItems, autoApprovedItems, requestId }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("[EMAIL] Skipped — EMAIL_USER or EMAIL_PASS not set");
    return;
  }
  try {
    await getTransporter().sendMail({
      from: `"MediLink Admin" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `⚠️ Stock Approval Required — ${storeName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1B4F8A;padding:20px;border-radius:8px 8px 0 0">
            <h2 style="color:white;margin:0">MediLink — Stock Approval Required</h2>
          </div>
          <div style="padding:24px;background:#f9f9f9;border:1px solid #eee">
            <p style="font-size:16px">A pharmacy has submitted a stock invoice for review.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px;color:#666">Store</td><td style="padding:8px;font-weight:bold">${storeName}</td></tr>
              <tr style="background:#fff"><td style="padding:8px;color:#666">Total Items</td><td style="padding:8px">${totalItems}</td></tr>
              <tr><td style="padding:8px;color:#666">Auto-Approved</td><td style="padding:8px;color:#2e7d32">✅ ${autoApprovedItems} items</td></tr>
              <tr style="background:#fff"><td style="padding:8px;color:#666">Needs Review</td><td style="padding:8px;color:#e65100">⚠️ ${pendingItems} items</td></tr>
            </table>
            <a href="http://localhost:5173/admin/stock-requests" 
               style="display:inline-block;background:#1B4F8A;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
              Review in Admin Panel →
            </a>
          </div>
          <div style="padding:12px;text-align:center;color:#999;font-size:12px">
            MediLink 2.0 — Automated notification
          </div>
        </div>
      `,
    });
    console.log(`[EMAIL] Stock request notification sent for ${storeName}`);
  } catch (err) {
    console.error("[EMAIL] Failed to send:", err.message);
  }
};

module.exports = { sendStockRequestEmail };