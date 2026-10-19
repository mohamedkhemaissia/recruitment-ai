import nodemailer from 'nodemailer';

function readBoolean(value) {
  return String(value).toLowerCase() === 'true';
}

export function createEmailSender({ env = process.env, transportFactory = nodemailer.createTransport } = {}) {
  const configured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.MAIL_FROM);
  const transport = configured
    ? transportFactory({
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT || 465),
        secure: readBoolean(env.SMTP_SECURE ?? 'true'),
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      })
    : null;

  return {
    configured,
    async send(job) {
      if (!transport) throw new Error('SMTP_NOT_CONFIGURED');
      return transport.sendMail({
        from: env.MAIL_FROM,
        to: job.recipient_email,
        subject: job.subject,
        text: job.text_body,
        html: job.html_body,
      });
    },
  };
}
