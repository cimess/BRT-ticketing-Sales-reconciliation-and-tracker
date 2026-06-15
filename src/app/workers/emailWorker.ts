import { Resend } from 'resend';

export function getResend() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is missing here");
  }

  return new Resend(apiKey);
}

const resend = getResend();



const emailWrapper = (title: string, content: string, footerNote: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Brand Banner -->
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.15em;color:#64748b;text-transform:uppercase;">CimessInvest</p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
              
              <!-- Blue accent bar (premium top line - seen in Stripe, Vercel, GitHub) -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:4px;background-color:#2563eb;border-radius:12px 12px 0 0;"></td>
                </tr>
              </table>

              <!-- Card Content -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:40px 48px;">
                    ${content}
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 8px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">${footerNote}</p>
              <p style="margin:0;font-size:11px;color:#cbd5e1;">&copy; 2026 otebenVenture Financial Systems &middot; All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;


// ─────────────────────────────────────────────────────────────────────────────
// CORE SEND FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'noreply@cimessinvest.com',
      to: [to],
      subject,
      text,
      html: html || text,
    });

    console.log(data,": email sent successfully")
    if (error) {
        throw new Error(error.message)
    }

   
    return { success: true, messageId: data?.id };
  } catch (error) {
  console.log(error,"this is the error message")
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// 1. VERIFICATION EMAIL
// ─────────────────────────────────────────────────────────────────────────────
export const sendVerificationEmail = async (to: string, otp: string) => {
  const subject = 'Your Oteben Ventures verification code';

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;letter-spacing:-0.5px;">Verify your email address</h1>
    <p style="margin:0 0 32px;font-size:15px;color:#64748b;line-height:1.6;">
      Enter the code below to confirm your Oteben Ventures account. This code expires in <strong style="color:#0f172a;">15 minutes</strong>.
    </p>

    <!-- OTP Block -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr>
        <td align="center" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:28px 20px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.12em;color:#94a3b8;text-transform:uppercase;">One-Time Code</p>
          <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:44px;font-weight:800;color:#0f172a;letter-spacing:14px;">${otp}</p>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr>
        <td align="center">
          <a href="https://otebenVenture.com/verify?otp=${otp}&email=${to}"
             style="display:inline-block;background-color:#2563eb;color:#ffffff;padding:13px 36px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
            Verify Automatically &rarr;
          </a>
          <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">Or enter the code manually at otebenVenture.com/verify</p>
        </td>
      </tr>
    </table>

    <hr style="border:none;border-top:1px solid #f1f5f9;margin:0 0 24px;" />
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
      If you didn't create a otebenVenture account, you can safely ignore this email. Someone may have entered your address by mistake.
    </p>
  `;

  const html = emailWrapper('Verify your account', content, "You're receiving this because an account was created using this email address.");
  return sendEmail(to, subject, `Your otebenVenture verification code is: ${otp}`, html);
};


// ─────────────────────────────────────────────────────────────────────────────
// 2. WELCOME EMAIL
// ─────────────────────────────────────────────────────────────────────────────
export const sendWelcomeEmail = async (to: string, name: string, role: string) => {
  const isManager = role === 'MANAGER';
  const isAdmin = role === 'ADMIN';
  const roleLabel = isAdmin ? 'Administrator' : isManager ? 'Portfolio Manager' : 'Investor';
  const subject = `Welcome to otebenVenture, ${name}`;

  const clientItems = [
    { title: 'Live Market Dashboard', desc: 'Track thousands of stocks and crypto assets in real-time with live price data.' },
    { title: 'One-Click Trading', desc: 'Buy and sell assets instantly through our integrated order flow.' },
    { title: 'Dedicated Portfolio Manager', desc: 'Get paired with a licensed professional who manages your portfolio directly.' },
    { title: 'Performance Analytics', desc: 'Monitor gains, losses, and overall portfolio health with detailed charts.' },
  ];
  const managerItems = [
    { title: 'Client Portfolio Management', desc: 'Oversee and execute trades on behalf of all your assigned clients.' },
    { title: 'Advanced Analytics', desc: 'Access broader market data and per-client performance metrics.' },
    { title: 'Trade Request System', desc: 'Request, approve, and execute block trades with a full audit trail.' },
    { title: 'Secure & Monitored Architecture', desc: 'Every action is logged and monitored for full accountability.' },
  ];
  const adminItems = [
    { title: 'Full Platform Oversight', desc: 'Monitor all users, managers, trades, and system health from one view.' },
    { title: 'Incident Command Center', desc: 'Manage security reports, bug tickets, and fraud investigations.' },
    { title: 'Risk & Access Controls', desc: 'Restrict, approve, or escalate any account with a single action.' },
  ];

  const items = isAdmin ? adminItems : isManager ? managerItems : clientItems;

  const featureRows = items.map(item => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #f1f5f9;">
        <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#0f172a;">${item.title}</p>
        <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">${item.desc}</p>
      </td>
    </tr>`).join('');

  const content = `
    <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:#0f172a;letter-spacing:-0.5px;">Welcome aboard, ${name}</h1>
    <p style="margin:0 0 28px;font-size:14px;color:#64748b;">
      Your account has been created as a <strong style="color:#2563eb;">${roleLabel}</strong>. You're all set to get started.
    </p>

    <!-- What you get -->
    <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.1em;color:#94a3b8;text-transform:uppercase;">What's included in your account</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      ${featureRows}
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr>
        <td align="center">
          <a href="https://otebenVenture.com/login"
             style="display:inline-block;background-color:#2563eb;color:#ffffff;padding:13px 40px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
            Open Your Dashboard &rarr;
          </a>
        </td>
      </tr>
    </table>

    <hr style="border:none;border-top:1px solid #f1f5f9;margin:0 0 24px;" />
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
      If you have any questions, reply to this email and our team will assist you promptly.
    </p>
  `;

  const html = emailWrapper(subject, content, "You're receiving this because you created a CimessInvest account.");
  return sendEmail(to, subject, `Welcome to CimessInvest, ${name}!`, html);
};


// ─────────────────────────────────────────────────────────────────────────────
// 3. REPORT EMAIL (submission + status update)
// ─────────────────────────────────────────────────────────────────────────────
export const sendReportEmail = async (
  to: string,
  name: string,
  subject: string,
  details: { type: string; status: string; message: string; resolution?: string }
) => {
  const isUpdate = !!details.resolution;
  const emailSubject = isUpdate
    ? `Update on your report: "${subject}"`
    : `Report received: "${subject}"`;

  const statusColor = (details.status === 'SUCCESS' || details.status === 'RESOLVED')
    ? '#16a34a' : details.status === 'REJECTED' ? '#dc2626' : '#d97706';
  const statusBg = (details.status === 'SUCCESS' || details.status === 'RESOLVED')
    ? '#f0fdf4' : details.status === 'REJECTED' ? '#fef2f2' : '#fffbeb';
  const statusBorder = (details.status === 'SUCCESS' || details.status === 'RESOLVED')
    ? '#bbf7d0' : details.status === 'REJECTED' ? '#fecaca' : '#fde68a';
  const statusLabel = (details.status === 'SUCCESS' || details.status === 'RESOLVED')
    ? 'Resolved' : details.status === 'REJECTED' ? 'Rejected' : 'Under Review';

  const content = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.4px;">
      ${isUpdate ? 'Your report has been updated' : 'We received your report'}
    </h1>
    <p style="margin:0 0 32px;font-size:15px;color:#64748b;line-height:1.6;">
      Hi <strong style="color:#0f172a;">${name}</strong>,
      ${isUpdate
        ? ' our team has reviewed your report and updated its status. See the details below.'
        : ' thank you for reaching out. Our team has been notified and will investigate shortly.'}
    </p>

    <!-- Report Details Table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:28px;">
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;background-color:#f8fafc;">
          <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.1em;color:#94a3b8;text-transform:uppercase;">Subject</p>
          <p style="margin:0;font-size:14px;font-weight:600;color:#0f172a;">${subject}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;">
          <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.1em;color:#94a3b8;text-transform:uppercase;">Category</p>
          <p style="margin:0;font-size:14px;color:#334155;">${details.type}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 20px;${details.resolution ? 'border-bottom:1px solid #f1f5f9;' : ''}">
          <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.1em;color:#94a3b8;text-transform:uppercase;">Status</p>
          <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;background-color:${statusBg};color:${statusColor};border:1px solid ${statusBorder};">
            ${statusLabel}
          </span>
        </td>
      </tr>
      ${details.resolution ? `
      <tr>
        <td style="padding:14px 20px;background-color:#f8fafc;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.1em;color:#94a3b8;text-transform:uppercase;">Admin Response</p>
          <p style="margin:0;font-size:14px;color:#334155;line-height:1.65;">${details.resolution}</p>
        </td>
      </tr>` : ''}
    </table>

    ${!isUpdate ? `
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">
      Our security and engineering team typically responds within <strong style="color:#0f172a;">1–3 business days</strong>. We'll email you as soon as the status changes.
    </p>` : ''}

    <hr style="border:none;border-top:1px solid #f1f5f9;margin:0 0 24px;" />
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
      Thank you for helping keep Oteben Ventures safe and trusted. If this report was submitted in error, you may ignore it.
    </p>
  `;

  const html = emailWrapper(emailSubject, content, "You're receiving this because you submitted a report on Oteben Ventures.");
  return sendEmail(to, emailSubject, details.message, html);
};


// ─────────────────────────────────────────────────────────────────────────────
// 4. BROADCAST / SYSTEM ANNOUNCEMENT
// ─────────────────────────────────────────────────────────────────────────────
export const broadcastSystemMessage = async (toEmails: string[], subject: string, message: string) => {
  const content = `
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;color:#94a3b8;text-transform:uppercase;">System Announcement</p>
    <h1 style="margin:0 0 28px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.4px;">${subject}</h1>

    <!-- Message box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #2563eb;border-radius:0 8px 8px 0;padding:20px 24px;">
          <p style="margin:0;font-size:15px;color:#334155;line-height:1.75;white-space:pre-line;">${message}</p>
        </td>
      </tr>
    </table>

    <hr style="border:none;border-top:1px solid #f1f5f9;margin:0 0 24px;" />
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
      This is an official announcement from the CimessInvest Administration Team. No action is required unless stated above.
    </p>
  `;

  const html = emailWrapper(subject, content, 'This is an automated broadcast from the Oteben Ventures Administration Team.');

  try {
    const { data, error } = await resend.emails.send({
      from: 'noreply@cimessinvest.com',
      to: toEmails,
      subject,
      html,
    });
    if (error) {
     throw new Error(error.message)
    }
    return { success: true, data };
  } catch (error) {
    console.log(error,"this is the error message")
    return { success: false, error };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. CONTACT US EMAIL (Guest/User Inquiries)
// ─────────────────────────────────────────────────────────────────────────────
export const sendContactUsEmail = async (name: string, email: string, subject: string, message: string) => {
  const adminEmail = process.env.ADMIN_EMAIL || 'cimessdev@gmail.com';
  const emailSubject = `New Contact Inquiry: ${subject}`;

  const content = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.4px;">New Inquiry Received</h1>
    <p style="margin:0 0 32px;font-size:15px;color:#64748b;line-height:1.6;">
      You have received a new message from the CimessInvest landing page contact form.
    </p>

    <!-- Details Table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:28px;">
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;background-color:#f8fafc;">
          <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.1em;color:#94a3b8;text-transform:uppercase;">From</p>
          <p style="margin:0;font-size:14px;font-weight:600;color:#0f172a;">${name} (${email})</p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;">
          <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.1em;color:#94a3b8;text-transform:uppercase;">Subject</p>
          <p style="margin:0;font-size:14px;color:#334155;">${subject}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 20px;background-color:#ffffff;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.1em;color:#94a3b8;text-transform:uppercase;">Message</p>
          <p style="margin:0;font-size:14px;color:#334155;line-height:1.65;white-space:pre-wrap;">${message}</p>
        </td>
      </tr>
    </table>

    <hr style="border:none;border-top:1px solid #f1f5f9;margin:0 0 24px;" />
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
      Please respond to the user directly at <a href="mailto:${email}" style="color:#2563eb;">${email}</a>.
    </p>
  `;

  const html = emailWrapper(emailSubject, content, "This inquiry was sent through the CimessInvest contact form.");
  return sendEmail(adminEmail, emailSubject, `Message from ${name} (${email}): ${message}`, html);
};

export default { sendEmail, sendWelcomeEmail, broadcastSystemMessage, sendContactUsEmail };
