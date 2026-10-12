const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
} = require('firebase-functions/v2/firestore');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const nodemailer = require('nodemailer');
const { resolveLocalRuntime } = require('./local-runtime');

const localRuntime = resolveLocalRuntime();
initializeApp(localRuntime ? { projectId: localRuntime.projectId } : undefined);

const db = getFirestore();
const smtpPassword = defineSecret('SPAI_SMTP_PASSWORD');

const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 587;
const SMTP_USER = 'noreply@tecplayacar.edu.mx';
const FROM_EMAIL = 'SPAI TUP <noreply@tecplayacar.edu.mx>';
const BRAND_LOGO_URL = 'https://spai-6ef68.web.app/brand/tup-logo-full.png';
const BRAND_MASCOT_URL = 'https://spai-6ef68.web.app/brand/tup-mascot-login.png';
const ASSIGNMENT_ALERTS_CONFIG_ID = 'notificaciones_asignaciones';

/**
 * Bitacora confiable, fase inicial.
 *
 * Estas entradas se generan desde Cloud Functions despues de que Firestore
 * confirma la operacion. No dependen de que la pantalla siga abierta ni de
 * codigo que pueda ejecutar el navegador del usuario.
 */
exports.auditAssignmentCreated = onDocumentCreated(
  { document: 'asignaciones/{assignmentId}', region: 'us-central1' },
  async (event) => {
    const assignment = event.data?.data();

    if (!assignment) {
      return null;
    }

    return writeTrustedAssignmentAudit({
      action: 'ASIGNACION_CREADA_SERVIDOR',
      assignmentId: event.params.assignmentId,
      after: assignment,
      changes: {},
    });
  },
);

exports.auditAssignmentUpdated = onDocumentUpdated(
  { document: 'asignaciones/{assignmentId}', region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      return null;
    }

    const changes = trustedAssignmentChanges(before, after);

    if (!Object.keys(changes).length) {
      return null;
    }

    return writeTrustedAssignmentAudit({
      action: after.deletedAt && !before.deletedAt
        ? 'ASIGNACION_ELIMINADA_SERVIDOR'
        : 'ASIGNACION_ACTUALIZADA_SERVIDOR',
      assignmentId: event.params.assignmentId,
      before,
      after,
      changes,
    });
  },
);

exports.auditAssignmentDeleted = onDocumentDeleted(
  { document: 'asignaciones/{assignmentId}', region: 'us-central1' },
  async (event) => {
    const assignment = event.data?.data();

    if (!assignment) {
      return null;
    }

    return writeTrustedAssignmentAudit({
      action: 'ASIGNACION_ELIMINADA_SERVIDOR',
      assignmentId: event.params.assignmentId,
      before: assignment,
      changes: { registro: { before: 'Activo', after: 'Eliminado permanentemente' } },
    });
  },
);

exports.auditAssignmentAlertsConfiguration = onDocumentUpdated(
  { document: `configuracion/${ASSIGNMENT_ALERTS_CONFIG_ID}`, region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() || {};
    const after = event.data?.after.data() || {};

    if (before.enabled === after.enabled) {
      return null;
    }

    return db.collection('bitacora').add({
      module: 'Bitacora',
      action: after.enabled ? 'ALERTAS_ASIGNACIONES_ACTIVADAS_SERVIDOR' : 'ALERTAS_ASIGNACIONES_PAUSADAS_SERVIDOR',
      description: after.enabled
        ? 'El servidor confirmo la activacion de alertas de cambios de asignaciones.'
        : 'El servidor confirmo la pausa de alertas de cambios de asignaciones.',
      user: trustedText(after.updatedByName, 'Usuario no identificado'),
      userRole: 'Sistemas',
      entity: 'configuracion',
      entityId: ASSIGNMENT_ALERTS_CONFIG_ID,
      metadata: {
        enabled: Boolean(after.enabled),
        updatedBy: trustedText(after.updatedBy, ''),
      },
      createdAt: new Date().toISOString(),
      serverRecordedAt: FieldValue.serverTimestamp(),
      source: 'SERVIDOR',
      integrity: 'VERIFICADO_SERVIDOR',
    });
  },
);

function writeTrustedAssignmentAudit({ action, assignmentId, before = null, after = null, changes }) {
  const assignment = after || before || {};
  const isDeleted = action.includes('ELIMINADA');
  const actorName = trustedText(
    isDeleted ? assignment.deletedByName : assignment.updatedByName || assignment.createdByName,
    'Usuario no identificado',
  );
  const actorRole = trustedText(
    isDeleted ? assignment.deletedByRole : assignment.updatedByRole || assignment.createdByRole,
    'Sin rol registrado',
  );
  const subject = [trustedText(assignment.subjectId, ''), trustedText(assignment.subjectName, 'Asignatura sin nombre')]
    .filter(Boolean)
    .join(' - ');
  const summary = Object.keys(changes)
    .map((field) => trustedAssignmentFieldLabel(field))
    .join(', ');

  return db.collection('bitacora').add({
    module: 'Asignaciones',
    action,
    description: isDeleted
      ? `El servidor confirmo la eliminacion de ${subject} (${trustedText(assignment.group, 'sin grupo')}).`
      : action.includes('CREADA')
        ? `El servidor confirmo el alta de ${subject} para ${trustedText(assignment.group, 'caso especial')}.`
        : `El servidor confirmo la actualizacion de ${subject}${summary ? `: ${summary}.` : '.'}`,
    user: actorName,
    userRole: actorRole,
    entity: 'asignaciones',
    entityId: assignmentId,
    metadata: {
      cycle: trustedText(assignment.cycle, ''),
      program: trustedText(assignment.program, ''),
      group: trustedText(assignment.group, ''),
      subjectId: trustedText(assignment.subjectId, ''),
      subjectName: trustedText(assignment.subjectName, ''),
      moodleId: trustedText(assignment.moodleId, ''),
      changedFields: Object.keys(changes).map((field) => trustedAssignmentFieldLabel(field)),
      changes,
    },
    createdAt: new Date().toISOString(),
    serverRecordedAt: FieldValue.serverTimestamp(),
    source: 'SERVIDOR',
    integrity: 'VERIFICADO_SERVIDOR',
  });
}

function trustedAssignmentChanges(before, after) {
  const fields = [
    'cycle', 'program', 'group', 'subjectId', 'subjectName', 'moodleId',
    'teacherMoodleUser', 'teacherName', 'status', 'shared', 'sharedGroups',
    'sharedPrograms', 'special', 'studentEnrollments', 'observations', 'deletedAt',
  ];

  return fields.reduce((changes, field) => {
    const previous = trustedComparableAssignmentValue(field, before[field]);
    const next = trustedComparableAssignmentValue(field, after[field]);

    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      changes[field] = { before: previous, after: next };
    }

    return changes;
  }, {});
}

function trustedComparableAssignmentValue(field, value) {
  if (field === 'studentEnrollments') {
    const amount = String(value || '').split(/[\s,;\n]+/).filter(Boolean).length;
    return amount ? `${amount} matricula(s)` : 'Sin matriculas adicionales';
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).sort();
  }

  if (typeof value === 'boolean') {
    return value ? 'Si' : 'No';
  }

  return trustedText(value, 'Sin dato');
}

function trustedAssignmentFieldLabel(field) {
  const labels = {
    cycle: 'Ciclo',
    program: 'Programa',
    group: 'Grupo base',
    subjectId: 'Clave de asignatura',
    subjectName: 'Asignatura',
    moodleId: 'ID Moodle',
    teacherMoodleUser: 'Usuario Moodle del docente',
    teacherName: 'Docente',
    status: 'Estatus',
    shared: 'Clase compartida',
    sharedGroups: 'Grupos compartidos',
    sharedPrograms: 'Programas compartidos',
    special: 'Caso especial',
    studentEnrollments: 'Matriculas adicionales',
    observations: 'Observaciones',
    deletedAt: 'Eliminacion',
  };

  return labels[field] || field;
}

function trustedText(value, fallback) {
  const text = String(value || '').trim();
  return text || fallback;
}

exports.sendEmailForNotification = onDocumentCreated(
  {
    document: 'notificaciones/{notificationId}',
    region: 'us-central1',
    secrets: localRuntime ? [] : [smtpPassword],
  },
  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      return;
    }

    const notification = snapshot.data();
    const notificationId = event.params.notificationId;

    // No recipients, Secret Manager, SMTP or remote assets are accessed locally.
    if (localRuntime) {
      await markEmailStatus(notificationId, {
        emailStatus: 'SIMULADO_LOCAL',
        emailUpdatedAt: FieldValue.serverTimestamp(),
        emailRecipients: [],
        emailRecipientCount: 0,
      });
      logger.info('Correo simulado en demo-spai-tup.', { notificationId });
      return;
    }

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

const security = require('./security/service');
const securityService = security.createSecurityService(db);
const securedCall = handler => onCall({ region: 'us-central1' }, async request => {
  try { return await handler(request); }
  catch (error) {
    const allowed = ['invalid-argument', 'unauthenticated', 'permission-denied', 'not-found', 'already-exists', 'failed-precondition', 'aborted', 'resource-exhausted'];
    const code = allowed.includes(error.code) ? error.code : error.code === 10 ? 'aborted' : 'internal';
    throw new HttpsError(code, code === 'internal' ? 'No se pudo confirmar la operación.' : error.message);
  }
});
exports.securityCommand = securedCall(request => securityService.execute(request.auth, request.data));
exports.securityDirectory = securedCall(request => securityService.list(request.auth));
exports.deliverSecurityNotification = onDocumentCreated({ document: 'eventos_seguridad/{eventId}', region: 'us-central1', retry: true }, event => security.processNotification(db, event.params.eventId, Boolean(localRuntime)));
exports.syncUserProfileByEmail = securedCall(async request => {
  const auth = request.auth;
  if (!auth?.uid || !auth.token?.email) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const email = String(auth.token.email).trim().toLowerCase();
  if (!email.endsWith('@tecplayacar.edu.mx') || auth.token.email_verified !== true) throw new HttpsError('permission-denied', 'Se requiere correo institucional verificado.');
  return db.runTransaction(async tx => {
    const fence = db.doc('seguridad/control'); const lock = await tx.get(fence);
    const uidRef = db.collection('usuarios').doc(auth.uid); const canonical = await tx.get(uidRef);
    // Never replace an existing canonical profile with a more privileged duplicate.
    if (canonical.exists && canonical.data().authUid === auth.uid) return { synced: true, uid: auth.uid };
    if (canonical.exists && !canonical.data().authUid && !canonical.data().identityAliasOf && canonical.data().email === email) {
      tx.update(uidRef, { authUid: auth.uid });
      tx.set(fence, { revision: (lock.data()?.revision || 0) + 1 });
      return { synced: true, uid: auth.uid };
    }
    const matches = await tx.get(db.collection('usuarios').where('email', '==', email).limit(3));
    const candidates = matches.docs.filter(d => d.id !== auth.uid && !d.data().identityAliasOf);
    if (!candidates.length) return { synced: false, reason: 'not-found' };
    if (candidates.length !== 1 || (candidates[0].data().authUid && candidates[0].data().authUid !== auth.uid)) throw new HttpsError('failed-precondition', 'Identidad ambigua; solicita revisión administrativa.');
    if (canonical.exists) throw new HttpsError('failed-precondition', 'El perfil existente requiere revisión antes de vincularse.');
    const source = candidates[0]; const now = new Date().toISOString();
    const references = await Promise.all(['delegaciones', 'asignaciones_roles', 'revisiones_roles'].map(collection => tx.get(db.collection(collection).where('userId', '==', source.id).limit(101))));
    if (references.reduce((n, snapshot) => n + snapshot.size, 0) > 100) throw new HttpsError('resource-exhausted', 'La vinculación requiere revisión de referencias por lotes.');
    for (const snapshot of references) for (const reference of snapshot.docs) tx.update(reference.ref, { userId: auth.uid, revision: (reference.data().revision || 0) + 1 });
    tx.create(uidRef, { ...source.data(), id: auth.uid, authUid: auth.uid, identitySourceId: source.id, revision: (source.data().revision || 0) + 1, updatedAt: now });
    // Preserve historical references; canonical access resolves through the UID.
    tx.update(source.ref, { identityAliasOf: auth.uid, updatedAt: now });
    tx.set(fence, { revision: (lock.data()?.revision || 0) + 1 });
    return { synced: true, uid: auth.uid, sourceUserId: source.id, deletedDuplicates: 0 };
  });
});

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
    const systemsUsers = users.filter((user) => user.permissionSchemaVersion === 2 && !user.identityAliasOf && user.baseRole === 'ADMIN_GENERAL');
    const recipients = notification.type === 'AGENDA_EQUIPO'
      ? systemsUsers.filter((user) => !isNotificationActor(user, notification.actorId))
      : systemsUsers;

    return uniqueEmails(recipients.map((user) => user.email));
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

function isNotificationActor(user, actorId) {
  const normalizedActorId = normalizeTarget(actorId);

  return Boolean(normalizedActorId) && [user.id, user.authUid]
    .some((value) => normalizeTarget(value) === normalizedActorId);
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
    if (notification.type === 'ASIGNACION_MODIFICADA') {
      return 'Equipo de Sistemas, se registró un cambio en una asignación por Coordinación Académica.';
    }

    if (notification.type === 'AGENDA_EQUIPO') {
      return 'Equipo de Sistemas, se agregó una nueva actividad a la agenda operativa.';
    }

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

  if (notification.type === 'AGENDA_EQUIPO') {
    return [
      `${actorName} agregó una actividad de equipo: ${title}.`,
      message,
    ].filter((line, index) => index === 0 || Boolean(line));
  }

  if (notification.type === 'ASIGNACION_MODIFICADA') {
    return [message].filter(Boolean);
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

  if (notification.type === 'AGENDA_EQUIPO') {
    return [
      `<strong>${escapedActor}</strong> agregó una actividad de equipo: ${escapeHtml(title)}.`,
      message ? escapeHtml(message) : '',
    ].filter((line, index) => index === 0 || Boolean(line));
  }

  if (notification.type === 'ASIGNACION_MODIFICADA') {
    return [message ? escapeHtml(message) : 'Se registró un cambio en una asignación.'];
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
