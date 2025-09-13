import nodemailer from "nodemailer";
import "dotenv/config";

export const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function sendOtpMail(to, code) {
  const html = `
    <div style="font-family:Arial,sans-serif">
      <h2>Mã OTP đặt lại mật khẩu</h2>
      <p>Mã xác thực của bạn là: <b style="font-size:20px">${code}</b></p>
      <p>Mã có hiệu lực trong 10 phút.</p>
    </div>`;
  await mailer.sendMail({ to, from: process.env.EMAIL_FROM || process.env.SMTP_USER, subject: "Mã OTP đặt lại mật khẩu", html });
}
