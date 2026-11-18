const nodemailer = require('nodemailer');
const config = require('../config');
const Job = require('../models/Job');
const { sleep, log, progress } = require('../lib');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let transportPromise;

function getTransport() {
  if (!transportPromise) {
    transportPromise = (async () => {
      if (config.mailMode === 'ethereal') {
        const account = await nodemailer.createTestAccount();
        return nodemailer.createTransport({
          host: account.smtp.host,
          port: account.smtp.port,
          secure: account.smtp.secure,
          auth: { user: account.user, pass: account.pass },
        });
      }
      return nodemailer.createTransport({ jsonTransport: true });
    })();
  }
  return transportPromise;
}

async function sendEmail(job) {
  const { to, subject = '(no subject)', body = '', forceFail } = job.data;
  const doc = await Job.findOne({ queueJobId: job.id });

  // Idempotent: a retry or crash recovery must never send the same email twice.
  if (doc && doc.emailSentAt) {
    await log(job, 'warn', 'Email was already sent earlier, skipping duplicate send');
    return doc.result || { skipped: true };
  }

  await log(job, 'info', `Preparing email to ${to}`);
  await progress(job, 20);
  await sleep(config.simulateWorkMs / 2);

  if (!to || !EMAIL_RE.test(to)) throw new Error(`Invalid recipient address: "${to ?? ''}"`);
  // Demo switch: simulates a down SMTP server so you can show retry -> dead-letter.
  if (forceFail) throw new Error('SMTP connection timed out (simulated outage)');

  await progress(job, 60);
  const transport = await getTransport();
  const info = await transport.sendMail({
    from: '"Orchestra" <no-reply@orchestra.dev>',
    to,
    subject,
    text: body || 'Sent by an Orchestra worker.',
  });

  const result = {
    messageId: info.messageId,
    to,
    previewUrl: config.mailMode === 'ethereal' ? nodemailer.getTestMessageUrl(info) : undefined,
  };
  await Job.updateOne({ queueJobId: job.id }, { emailSentAt: new Date() });
  await log(job, 'info', `Email delivered to ${to}`);
  await progress(job, 100);
  return result;
}

module.exports = { sendEmail, EMAIL_RE };
