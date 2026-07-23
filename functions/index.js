const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const nodemailer = require('nodemailer');

initializeApp();

const db = getFirestore();
const smtpPassword = defineSecret('SPAI_SMTP_PASSWORD');

const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 587;
const SMTP_USER = 'noreply@tecplayacar.edu.mx';
const FROM_EMAIL = 'SPAI TUP <noreply@tecplayacar.edu.mx>';
const BRAND_LOGO_URL = 'https://spai-6ef68.web.app/brand/tup-logo-full.png';
const BRAND_MASCOT_URL = 'https://spai-6ef68.web.app/brand/tup-mascot-login.png';

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

    if (shouldSkipAssignmentMilestoneEmail(notification)) {
      await markEmailStatus(notificationId, {
        emailStatus: 'OMITIDO_HITO_NO_VALIDO',
        emailUpdatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

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
        subject: `SPAI TUP - ${notification.title || 'Nueva notificacion'}`,
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

exports.syncUserProfileByEmail = onCall(
  {
    region: 'us-central1',
  },
  async (request) => {
    const auth = request.auth;

    if (!auth?.uid || !auth.token?.email) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion para sincronizar el perfil.');
    }

    const email = String(auth.token.email).trim().toLowerCase();

    if (!email.endsWith('@tecplayacar.edu.mx')) {
      throw new HttpsError('permission-denied', 'Solo se permiten correos institucionales.');
    }

    const usersSnapshot = await db.collection('usuarios').get();
    const matchingUsers = usersSnapshot.docs
      .map((doc) => ({ ref: doc.ref, id: doc.id, data: doc.data() }))
      .filter((user) => normalizeTarget(user.data.email) === normalizeTarget(email));

    if (!matchingUsers.length) {
      return { synced: false, reason: 'not-found' };
    }

    const activeUsers = matchingUsers.filter((user) => normalize(user.data.status) === 'activo');
    const source = pickUserProfileSource(activeUsers.length ? activeUsers : matchingUsers, auth.uid);

    if (!source) {
      return { synced: false, reason: 'not-found' };
    }

    const sourceData = source.data;
    const timestamp = new Date().toISOString();
    const payload = userProfilePayloadForUid(sourceData, auth.uid, email, timestamp);

    const batch = db.batch();
    const uidRef = db.collection('usuarios').doc(auth.uid);
    batch.set(uidRef, payload, { merge: true });

    const duplicateUsers = matchingUsers.filter((user) => user.id !== auth.uid);

    duplicateUsers.forEach((user) => {
      batch.delete(user.ref);
    });

    await batch.commit();

    return {
      synced: true,
      sourceUserId: source.id,
      uid: auth.uid,
      deletedDuplicates: duplicateUsers.length,
    };
  },
);

function pickUserProfileSource(users, authUid) {
  const uidUser = users.find((user) => user.id === authUid && normalize(user.data.status) === 'activo');

  if (uidUser && Array.isArray(uidUser.data.assignedPrograms) && uidUser.data.assignedPrograms.length > 0) {
    return uidUser;
  }

  return users.find((user) => user.id !== authUid && Array.isArray(user.data.assignedPrograms) && user.data.assignedPrograms.length > 0)
    || uidUser
    || users.find((user) => user.id !== authUid)
    || users[0]
    || null;
}

function userProfilePayloadForUid(sourceData, authUid, email, timestamp) {
  const fieldsToCopy = [
    'name',
    'role',
    'greetingGender',
    'assignedPrograms',
    'access',
    'status',
    'createdAt',
  ];
  const payload = {};

  fieldsToCopy.forEach((field) => {
    if (sourceData[field] !== undefined) {
      payload[field] = sourceData[field];
    }
  });

  return {
    ...payload,
    email,
    authUid,
    syncedFromUserDoc: FieldValue.delete(),
    updatedAt: timestamp,
  };
}

function shouldSkipAssignmentMilestoneEmail(notification) {
  if (notification.type !== 'ASIGNACIONES_HITO') {
    return false;
  }

  const milestone = milestoneFromNotification(notification);

  return !milestone || milestone % 15 !== 0;
}

function milestoneFromNotification(notification) {
  const candidates = [
    notification.milestone,
    notification.title,
    notification.message,
    notification.entityId,
  ];

  for (const candidate of candidates) {
    const match = String(candidate ?? '').match(/(?:hito\s+de\s+)?(\d+)\s+asignaciones/i);

    if (match) {
      return Number(match[1]);
    }
  }

  return 0;
}

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
  const messageLines = notificationMessageLines(notification);

  return [
    'El sistema SPAI notifica.',
    '',
    audienceMessage(notification),
    ...messageLines.map((line) => line ? line : ''),
    'Por favor darle seguimiento.',
  ].join('\n');
}

function htmlBody(notification) {
  const messageLines = notificationHtmlMessageLines(notification);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f7ff;margin:0;padding:28px 0;font-family:Arial,sans-serif;color:#07183f">
      <tr>
        <td align="center">
          <table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:680px;max-width:100%;background:#ffffff;border:1px solid #d7e4f8;border-radius:10px;overflow:hidden">
            <tr>
              <td style="background:#071f5f;border-top:4px solid #41b9e8;padding:22px 30px 24px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle">
                      <img src="${BRAND_LOGO_URL}" width="290" alt="Tecnologico Universitario Playacar" style="display:block;max-width:290px;width:100%;height:auto;margin:0 0 16px;filter:drop-shadow(0 10px 22px rgba(2,8,23,0.28))">
                      <div style="color:#c8d7ff;font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase">Sistema de Planeacion Academica Institucional</div>
                      <h1 style="color:#ffffff;font-size:24px;line-height:1.18;margin:8px 0 0">El sistema SPAI notifica.</h1>
                    </td>
                    <td width="110" align="right" style="vertical-align:middle">
                      <img src="${BRAND_MASCOT_URL}" width="76" alt="" style="display:block;width:76px;max-width:76px;height:auto">
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 30px 22px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fbff;border:1px solid #d7e4f8;border-left:5px solid #1e3a8a;border-radius:8px">
                  <tr>
                    <td style="padding:22px 24px">
                      <p style="font-size:18px;line-height:1.62;margin:0 0 18px;color:#07183f"><strong>${escapeHtml(audienceMessage(notification))}</strong></p>
                      ${messageLines.map((line) => (
                        line
                          ? `<p style="font-size:18px;line-height:1.62;margin:0 0 16px;color:#1f3357">${line}</p>`
                          : '<div style="height:4px"></div>'
                      )).join('')}
                      <p style="font-size:18px;line-height:1.62;margin:0;color:#07183f"><strong>Por favor darle seguimiento.</strong></p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#f8fbff;border-top:1px solid #d7e4f8;padding:16px 30px;color:#64748b;font-size:12px;line-height:1.45">
                Este correo fue generado automaticamente por SPAI TUP. No respondas a este mensaje.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function audienceMessage(notification) {
  if (notification.target === 'SISTEMAS') {
    return 'Equipo de Sistemas, ha llegado una nueva solicitud.';
  }

  return 'Ha llegado una nueva notificacion para seguimiento.';
}

function notificationMessageLines(notification) {
  const actorName = notification.actorName || 'la coordinacion correspondiente';
  const title = notification.title || 'Nueva notificacion';
  const message = notification.message || '';

  if (notification.type === 'DOCENTE_NUEVO') {
    return [
      `La Coordinacion Academica correspondiente a ${actorName} agrego un nuevo docente.`,
      message,
    ].filter((line, index) => index === 0 || Boolean(line));
  }

  return [
    `La Coordinacion Academica correspondiente a ${actorName} genero la siguiente solicitud: ${title}.`,
    message,
  ].filter((line, index) => index === 0 || Boolean(line));
}

function notificationHtmlMessageLines(notification) {
  const actorName = notification.actorName || 'la coordinacion correspondiente';
  const title = notification.title || 'Nueva notificacion';
  const message = notification.message || '';
  const escapedActor = escapeHtml(actorName);

  if (notification.type === 'DOCENTE_NUEVO') {
    return [
      `La Coordinacion Academica correspondiente a <strong>${escapedActor}</strong> agrego un nuevo docente.`,
      message ? escapeHtml(message) : '',
    ].filter((line, index) => index === 0 || Boolean(line));
  }

  return [
    `La Coordinacion Academica correspondiente a <strong>${escapedActor}</strong> genero la siguiente solicitud: ${escapeHtml(title)}.`,
    message ? escapeHtml(message) : '',
  ].filter((line, index) => index === 0 || Boolean(line));
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
