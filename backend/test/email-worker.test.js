import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmailSender } from '../src/services/email-sender.service.js';
import { createEmailWorker } from '../src/workers/email.worker.js';

test('le worker reste inactif lorsque SMTP n’est pas configuré', async () => {
  let claimed = false;
  const worker = createEmailWorker({
    jobService: {
      async recoverInterrupted() {},
      async claimNext() {
        claimed = true;
      },
    },
    emailSender: { configured: false },
  });

  assert.equal(await worker.processNext(), null);
  assert.equal(claimed, false);
});

test('le worker envoie puis confirme un e-mail', async () => {
  const calls = [];
  const job = { id: 4, recipient_email: 'candidate@example.com' };
  const worker = createEmailWorker({
    jobService: {
      async recoverInterrupted() { calls.push('recover'); },
      async claimNext() { calls.push('claim'); return job; },
      async markSent(id) { calls.push(`sent:${id}`); return { id, status: 'sent' }; },
    },
    emailSender: {
      configured: true,
      async send(value) { calls.push(`send:${value.id}`); },
    },
  });

  assert.deepEqual(await worker.processNext(), { id: 4, status: 'sent' });
  assert.deepEqual(calls, ['recover', 'claim', 'send:4', 'sent:4']);
});

test('le worker enregistre l’échec SMTP avant de propager l’erreur', async () => {
  let failure;
  const worker = createEmailWorker({
    jobService: {
      async recoverInterrupted() {},
      async claimNext() { return { id: 8 }; },
      async markFailed(data) { failure = data; },
    },
    emailSender: {
      configured: true,
      async send() { throw new Error('SMTP temporairement indisponible'); },
    },
  });

  await assert.rejects(worker.processNext(), /SMTP temporairement indisponible/);
  assert.deepEqual(failure, { id: 8, errorMessage: 'SMTP temporairement indisponible' });
});

test('le transport SMTP utilise uniquement la configuration fournie', async () => {
  let transportOptions;
  let sentMessage;
  const sender = createEmailSender({
    env: {
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'sender@example.com',
      SMTP_PASSWORD: 'secret-test-only',
      MAIL_FROM: 'Bee Coders <sender@example.com>',
    },
    transportFactory(options) {
      transportOptions = options;
      return {
        async sendMail(message) {
          sentMessage = message;
          return { accepted: [message.to] };
        },
      };
    },
  });

  assert.equal(sender.configured, true);
  await sender.send({
    recipient_email: 'candidate@example.com',
    subject: 'Statut',
    text_body: 'Texte',
    html_body: '<p>Texte</p>',
  });
  assert.deepEqual(transportOptions, {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: 'sender@example.com', pass: 'secret-test-only' },
  });
  assert.equal(sentMessage.to, 'candidate@example.com');
});
