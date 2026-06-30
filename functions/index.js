const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const nodemailer = require('nodemailer');

initializeApp();

const db = getFirestore();
const smtpPassword = defineSecret('SPAI_SMTP_PASSWORD');

const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 587;
const SMTP_USER = 'noreply@tecplayacar.edu.mx';
const FROM_EMAIL = 'SPAI TUP <noreply@tecplayacar.edu.mx>';

exports.sendEmailForNotification = onDocumentCreated(
  {
    document: 'notificaciones/{notificationId}',
    region: 'us-central1',
    secrets: [smtpPassword],
  },
  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      return;
    }

    const notification = snapshot.data();
    const notificationId = event.params.notificationId;
    const recipients = await recipientsForNotification(notification);

    if (!recipients.length) {
      await markEmailStatus(notificationId, {
        emailStatus: 'SIN_DESTINATARIOS',
        emailUpdatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      auth: {
        user: SMTP_USER,
        pass: smtpPassword.value(),
      },
    });

    try {
      await transporter.sendMail({
        from: FROM_EMAIL,
        to: recipients,
        subject: `[SPAI TUP] ${notification.title || 'Nueva notificacion'}`,
        text: plainTextBody(notification),
        html: htmlBody(notification),
      });

      await markEmailStatus(notificationId, {
        emailStatus: 'ENVIADO',
        emailSentAt: FieldValue.serverTimestamp(),
        emailRecipients: recipients,
        emailRecipientCount: recipients.length,
      });
    } catch (error) {
      logger.error('No se pudo enviar correo de notificacion SPAI.', {
        notificationId,
        target: notification.target,
        type: notification.type,
        error: error.message,
      });

      await markEmailStatus(notificationId, {
        emailStatus: 'ERROR',
        emailUpdatedAt: FieldValue.serverTimestamp(),
        emailError: error.message || 'Error desconocido',
      });
    }
  },
);

async function recipientsForNotification(notification) {
  const usersSnapshot = await db.collection('usuarios').get();
  const users = usersSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((user) => normalize(user.status) === 'activo')
    .filter((user) => user.email && String(user.email).includes('@'));

  if (notification.target === 'SISTEMAS') {
    return uniqueEmails(users
      .filter((user) => normalize(user.role).includes('sistemas'))
      .map((user) => user.email));
  }

  if (notification.target !== 'COORDINACION_ACADEMICA') {
    return [];
  }

  const target = normalizeTarget(notification.targetUserId);

  if (!target) {
    return [];
  }

  return uniqueEmails(users
    .filter((user) => matchesAcademicTarget(user, target))
    .map((user) => user.email));
}

function matchesAcademicTarget(user, target) {
  const directTargets = [
    user.id,
    user.authUid,
    user.email,
  ].map(normalizeTarget);
  const assignedPrograms = Array.isArray(user.assignedPrograms)
    ? user.assignedPrograms.map(normalizeTarget)
    : [];

  return directTargets.includes(target) || assignedPrograms.includes(target);
}

function plainTextBody(notification) {
  return [
    notification.title || 'Nueva notificacion SPAI TUP',
    '',
    notification.message || '',
    '',
    `Tipo: ${notification.type || 'Sin tipo'}`,
    `Modulo: ${notification.entity || 'SPAI TUP'}`,
    `Generado por: ${notification.actorName || 'SPAI TUP'}`,
  ].join('\n');
}

function htmlBody(notification) {
  return `
    <div style="font-family:Arial,sans-serif;color:#07183f;line-height:1.45">
      <h2 style="margin:0 0 12px;color:#143f91">${escapeHtml(notification.title || 'Nueva notificacion SPAI TUP')}</h2>
      <p style="font-size:15px;margin:0 0 16px">${escapeHtml(notification.message || '')}</p>
      <table style="border-collapse:collapse;font-size:13px;color:#334866">
        <tr><td style="padding:4px 12px 4px 0;font-weight:700">Tipo</td><td>${escapeHtml(notification.type || 'Sin tipo')}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:700">Modulo</td><td>${escapeHtml(notification.entity || 'SPAI TUP')}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:700">Generado por</td><td>${escapeHtml(notification.actorName || 'SPAI TUP')}</td></tr>
      </table>
      <p style="margin-top:18px;font-size:12px;color:#64748b">Este correo fue generado automaticamente por SPAI TUP.</p>
    </div>
  `;
}

function markEmailStatus(notificationId, payload) {
  return db.collection('notificaciones').doc(notificationId).set(payload, { merge: true });
}

function uniqueEmails(emails) {
  return Array.from(new Set(
    emails
      .map((email) => String(email).trim().toLowerCase())
      .filter(Boolean),
  ));
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeTarget(value) {
  return normalize(value).toUpperCase();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
