/**
 * Email Service
 *
 * Handles sending emails for invitations, notifications, and other communication
 * Supports multiple email providers (SendGrid, Mailgun, SMTP)
 */

import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface InvitationEmailData {
  inviteeName: string;
  inviterName: string;
  inviterCompany?: string;
  invitationCode: string;
  invitationType: 'agency' | 'user';
  customMessage?: string;
  acceptUrl: string;
}

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  /**
   * Initialize email transporter based on environment variables
   */
  private static getTransporter(): nodemailer.Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';

    if (emailProvider === 'sendgrid' && process.env.SENDGRID_API_KEY) {
      // SendGrid configuration
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY
        }
      });
    } else if (emailProvider === 'mailgun' && process.env.MAILGUN_API_KEY) {
      // Mailgun configuration
      this.transporter = nodemailer.createTransport({
        host: process.env.MAILGUN_SMTP_HOST || 'smtp.mailgun.org',
        port: 587,
        auth: {
          user: process.env.MAILGUN_SMTP_USER,
          pass: process.env.MAILGUN_API_KEY
        }
      });
    } else if (process.env.SMTP_HOST) {
      // Generic SMTP configuration
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        } : undefined
      });
    } else {
      // Development mode: log emails to console
      logger.warn('[EMAIL] No email provider configured, emails will be logged to console');
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true
      });
    }

    return this.transporter;
  }

  /**
   * Send a generic email
   */
  static async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      const from = options.from || process.env.EMAIL_FROM || 'noreply@echosenseix.com';

      const mailOptions = {
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html)
      };

      const info = await transporter.sendMail(mailOptions);

      if (info.messageId) {
        logger.info(`[EMAIL] Email sent successfully to ${options.to}`, { messageId: info.messageId });
      } else {
        logger.info(`[EMAIL] Email logged (dev mode):`, {
          to: options.to,
          subject: options.subject,
          preview: options.html.substring(0, 200)
        });
      }

      return true;
    } catch (error: any) {
      logger.error(`[EMAIL] Failed to send email to ${options.to}:`, error);
      return false;
    }
  }

  /**
   * Send agency invitation email
   */
  static async sendAgencyInvitation(email: string, data: InvitationEmailData): Promise<boolean> {
    const subject = `You're invited to join ${data.inviterCompany || 'our platform'} as an Agency Partner`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .invitation-code { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; font-family: monospace; font-size: 18px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Agency Invitation</h1>
    </div>
    <div class="content">
      <p>Hello ${data.inviteeName},</p>

      <p><strong>${data.inviterName}</strong>${data.inviterCompany ? ` from <strong>${data.inviterCompany}</strong>` : ''} has invited you to become an Agency Partner on EchoSenseiX!</p>

      ${data.customMessage ? `<p style="background: white; padding: 15px; border-left: 4px solid #764ba2; margin: 20px 0;"><em>"${data.customMessage}"</em></p>` : ''}

      <p>As an Agency Partner, you'll be able to:</p>
      <ul>
        <li>Manage your own clients and sub-accounts</li>
        <li>Earn commissions on customer usage</li>
        <li>Access white-label features</li>
        <li>Get dedicated support and resources</li>
      </ul>

      <div class="invitation-code">
        <strong>Invitation Code:</strong> ${data.invitationCode}
      </div>

      <center>
        <a href="${data.acceptUrl}" class="button">Accept Invitation</a>
      </center>

      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        Or copy and paste this link into your browser:<br>
        <a href="${data.acceptUrl}">${data.acceptUrl}</a>
      </p>
    </div>
    <div class="footer">
      <p>This invitation will expire in 7 days.</p>
      <p>&copy; ${new Date().getFullYear()} EchoSenseiX. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html
    });
  }

  /**
   * Send user invitation email
   */
  static async sendUserInvitation(email: string, data: InvitationEmailData): Promise<boolean> {
    const subject = `You're invited to join ${data.inviterCompany || 'EchoSenseiX'}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .invitation-code { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; font-family: monospace; font-size: 18px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Team Invitation</h1>
    </div>
    <div class="content">
      <p>Hello ${data.inviteeName},</p>

      <p><strong>${data.inviterName}</strong>${data.inviterCompany ? ` from <strong>${data.inviterCompany}</strong>` : ''} has invited you to join their team on EchoSenseiX!</p>

      ${data.customMessage ? `<p style="background: white; padding: 15px; border-left: 4px solid #764ba2; margin: 20px 0;"><em>"${data.customMessage}"</em></p>` : ''}

      <div class="invitation-code">
        <strong>Invitation Code:</strong> ${data.invitationCode}
      </div>

      <center>
        <a href="${data.acceptUrl}" class="button">Accept Invitation</a>
      </center>

      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        Or copy and paste this link into your browser:<br>
        <a href="${data.acceptUrl}">${data.acceptUrl}</a>
      </p>
    </div>
    <div class="footer">
      <p>This invitation will expire in 7 days.</p>
      <p>&copy; ${new Date().getFullYear()} EchoSenseiX. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html
    });
  }

  /**
   * Strip HTML tags from text
   */
  private static stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}

export default EmailService;
