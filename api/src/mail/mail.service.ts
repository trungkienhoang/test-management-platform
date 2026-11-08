import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    this.initTransporter();
  }

  private initTransporter() {
    const host = this.config.get<string>('SMTP_HOST') || 'smtp.gmail.com';
    const port = parseInt(this.config.get<string>('SMTP_PORT') || '587', 10);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for 587
        auth: {
          user,
          pass,
        },
      });
      this.logger.log(`📧 SMTP mailer initialized with host: ${host}:${port} (${user})`);
    } else {
      this.logger.warn(
        '⚠️ SMTP_USER hoặc SMTP_PASS chưa được cấu hình trong .env. Mã OTP sẽ được in ra console trong lúc phát triển.',
      );
    }
  }

  async sendOtpEmail(toEmail: string, otp: string, fullName: string): Promise<boolean> {
    const from =
      this.config.get<string>('SMTP_FROM') ||
      this.config.get<string>('SMTP_USER') ||
      '"Test Management Platform" <noreply@testplatform.dev>';

    // Fallback log for development & debugging
    this.logger.log(`\n======================================================\n` +
      `📧 [MÃ XÁC THỰC OTP ĐĂNG KÝ]\n` +
      `Gửi tới: ${toEmail} (${fullName})\n` +
      `Mã OTP: [ ${otp} ] (Hiệu lực: 5 phút)\n` +
      `======================================================\n`);

    if (!this.transporter) {
      this.logger.warn(
        `Không có kết nối SMTP thực tế. Hãy điền SMTP_USER và SMTP_PASS (Gmail App Password) trong file .env để gửi email thật.`,
      );
      return true; // Still return true so dev flow proceeds
    }

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background-color: #f8fafc; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; font-size: 26px; background-color: #4f46e5; color: #ffffff; border-radius: 12px;">🧪</div>
          <h2 style="color: #0f172a; margin: 12px 0 4px 0; font-size: 22px; font-weight: 700;">Xác thực tài khoản</h2>
          <p style="color: #64748b; font-size: 13px; margin: 0;">Test Management Platform</p>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <p style="font-size: 14px; color: #334155; margin-top: 0;">Xin chào <strong>${fullName}</strong>,</p>
          <p style="font-size: 14px; color: #334155; line-height: 1.5;">
            Cảm ơn bạn đã đăng ký tài khoản trên nền tảng Quản lý Kiểm thử Phần mềm. Dưới đây là mã xác thực OTP của bạn:
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <div style="display: inline-block; padding: 14px 28px; background-color: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; font-family: monospace;">
              ${otp}
            </div>
            <p style="font-size: 12px; color: #64748b; margin-top: 8px;">Mã này có hiệu lực trong vòng <strong>5 phút</strong>.</p>
          </div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 0;">
            Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email. Tuyệt đối không chia sẻ mã OTP với bất kỳ ai để bảo vệ an toàn cho tài khoản.
          </p>
        </div>

        <div style="text-align: center; margin-top: 24px; font-size: 11px; color: #94a3b8;">
          © 2026 Test Management Platform. Hệ thống tự động gửi email, vui lòng không trả lời thư này.
        </div>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from,
        to: toEmail,
        subject: `[Test Platform] ${otp} là mã xác thực đăng ký tài khoản của bạn`,
        html: htmlContent,
      });
      this.logger.log(`✅ Đã gửi email OTP thành công tới ${toEmail}`);
      return true;
    } catch (err) {
      this.logger.error(`❌ Gửi email OTP thất bại tới ${toEmail}:`, err);
      // Even if SMTP server rejected, in development we don't block the user
      return false;
    }
  }
}
