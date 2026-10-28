'use strict';
const { createHash, createHmac, timingSafeEqual, randomUUID } = require('node:crypto');
const P = require('./policy');
const COLLECTIONS = ['usuarios','roles_personalizados','delegaciones','asignaciones_roles','revisiones_roles','mapeos_permisos'];
const stable = value => JSON.stringify(value, (_k,v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])) : v);
const hash = value => createHash('sha256').update(stable(value)).digest('hex');
const emailOf = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validId = value => { P.assert(typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value),'Identificador inválido.','invalid-argument'); return value; };
const publicResult = job => ({operationId:job.operationId,targetId:job.targetId,name:job.name,email:job.email,status:job.status,message:job.status==='COMPLETED' ? 'Baja completada. La cuenta de Authentication ya no existe.' : 'Acceso a SPAI bloqueado. La eliminación en Authentication sigue pendiente.',attempts:job.attempts,lastError:job.lastError ?? null});

function createUserDeletionService(db, authAdmin, {nowMillis=Date.now, previewKey}={}) {
  function key() { const value=typeof previewKey==='function'?previewKey():previewKey; P.assert(typeof value==='string' && value.length>=32,'La preparación de bajas no está configurada.','failed-precondition'); return value; }
  function sign(payload) { const text=Buffer.from(stable(payload)).toString('base64url'); return text+'.'+createHmac('sha256',key()).update(text).digest('base64url'); }
  function decode(token) {
    P.assert(typeof token==='string' && token.length<16000,'Preparación inválida.','invalid-argument');
    const [text,signature,...extra]=token.split('.');
    const expected=createHmac('sha256',key()).update(text).digest();
    const received=Buffer.from(signature??'','base64url');
    P.assert(!extra.length && received.length===expected.length && timingSafeEqual(received,expected),'La preparación no es válida. Vuelve a abrir la confirmación.','aborted');
    try {return JSON.parse(Buffer.from(text,'base64url').toString());} catch {P.fail('Preparación inválida.','invalid-argument');}
  }
  function requireAdmin(profile) { const actor=P.effective(profile); P.assert(actor.active && actor.baseRole==='ADMIN_GENERAL' && actor.capabilities.includes('MANAGE_USERS'),'Solo Administración General vigente puede eliminar usuarios.'); }
  async function administrator(tx, caller) { P.assert(caller?.uid,'Inicia sesión.','unauthenticated'); const snapshot=await tx.get(db.doc('usuarios/'+validId(caller.uid))); requireAdmin(snapshot.data()); return snapshot.data(); }
  async function boundedState(tx, caller) {
    const fence=db.doc('seguridad/control'); const lock=await tx.get(fence);
    const snapshots=await Promise.all(COLLECTIONS.map(c=>tx.get(db.collection(c).limit(201))));
    P.assert(snapshots.reduce((n,s)=>n+s.size,0)<=200,'Requiere migración administrativa por lotes: límite local de 200 documentos de seguridad.','resource-exhausted');
    const users=snapshots[0].docs.map(d=>({...d.data(),id:d.id}));
    const actor=users.find(u=>u.id===caller.uid);requireAdmin(actor);
    return {fence,lock,users,actor};
  }
  function targetFrom(users,targetId) {
    const target=users.find(u=>u.id===targetId);P.assert(target && !target.identityAliasOf && !target.deletedAt,'Selecciona un perfil vigente e inequívoco.','failed-precondition');
    const email=emailOf(target.email);
    P.assert(typeof target.name==='string' && target.name.trim().length>=2 && /^[a-z0-9._+-]+@tecplayacar\.edu\.mx$/.test(email),'El destinatario no tiene nombre y correo institucional inequívocos.','failed-precondition');
    P.assert(users.filter(u=>!u.identityAliasOf && emailOf(u.email)===email).length===1,'Identidad ambigua; requiere revisión administrativa.','failed-precondition');
    return target;
  }
  async function authIdentity(target) {
    let account;
    try {account=await authAdmin.getUserByEmail(emailOf(target.email));} catch(e) {
      if(e.code!=='auth/user-not-found') throw e;
      // A previously linked canonical UID is historical identity evidence, never infer from a display name.
      P.assert(target.authUid===target.id,'No se pudo verificar la identidad en Authentication.','failed-precondition');
      try {await authAdmin.getUser(target.authUid);P.fail('El UID está asociado con otra identidad.','failed-precondition');} catch(err) {if(err.code!=='auth/user-not-found')throw err;}
      return {uid:target.authUid,email:emailOf(target.email),createdAt:null};
    }
    P.assert(!target.authUid || target.authUid===account.uid,'El correo y el UID no corresponden a la misma identidad.','failed-precondition');
    return {uid:account.uid,email:emailOf(account.email),createdAt:account.metadata.creationTime};
  }
  async function prepare(caller,data) {
    const targetId=validId(data.targetId);
    const initial=await db.runTransaction(async tx=>{const state=await boundedState(tx,caller);const target=targetFrom(state.users,targetId);return {target,actor:state.actor,users:state.users};});
    const identity=await authIdentity(initial.target);
    P.assert(!initial.users.some(u=>u.id===identity.uid && u.id!==initial.target.id && u.identityAliasOf!==initial.target.id),'El UID tiene otro perfil institucional; requiere revisión de identidad.','failed-precondition');
    const issued=nowMillis();const payload={version:1,operator:caller.uid,targetId,actorHash:hash(initial.actor),targetHash:hash(initial.target),identity,issuedAt:issued,expiresAt:issued+5*60000};
    return {preview:{token:sign(payload),targetId,name:initial.target.name,email:identity.email,expiresAt:payload.expiresAt}};
  }
  async function begin(caller,data) {
    const operationId=hash([validId(caller.uid),validId(data.operationId)]), op=db.doc('operaciones_baja/'+operationId);
    const requestHash=hash({token:data.token,reason:data.reason});
    return db.runTransaction(async tx=>{
      // An already committed operation is recoverable even when the six-collection bound is now exceeded.
      await administrator(tx,caller);const previous=await tx.get(op);
      if(previous.exists){P.assert(previous.data().requestHash===requestHash,'Identificador de reintento reutilizado con datos distintos.','already-exists');return operationId;}
      const preview=decode(data.token);const reason=String(data.reason??'').trim();
      P.assert(reason.length>=4 && reason.length<=1000,'Indica un motivo (4–1000 caracteres).','invalid-argument');
      P.assert(preview.operator===caller.uid && preview.version===1,'La preparación pertenece a otro operador.');
      const state=await boundedState(tx,caller),target=targetFrom(state.users,preview.targetId);
      P.assert(!state.users.some(u=>u.id===preview.identity.uid && u.id!==target.id && u.identityAliasOf!==target.id),'La identidad institucional cambió; vuelve a revisar.','aborted');
      P.assert(preview.expiresAt>nowMillis() && preview.issuedAt<=nowMillis() && preview.actorHash===hash(state.actor) && preview.targetHash===hash(target),'La preparación venció o cambió el perfil. Vuelve a revisar antes de eliminar.','aborted');
      P.assert(state.users.some(u=>u.id!==target.id && P.isGeneral(u) && u.authUid===u.id),'Debe conservarse al menos un ADMIN_GENERAL activo y vinculado.','failed-precondition');
      const emailRef=db.doc('bajas_correo/'+preview.identity.email),uidRef=db.doc('bloqueos_identidad/'+preview.identity.uid),tombstone=db.doc('bajas_usuarios/'+target.id);
      const reserved=await Promise.all([tx.get(emailRef),tx.get(uidRef),tx.get(tombstone)]);
      P.assert(reserved.every(s=>!s.exists),'La identidad ya tiene una baja registrada. Consulta su seguimiento.','already-exists');
      const now=new Date(nowMillis()).toISOString();
      // Snapshot the authenticated requester's identity now; later completion must
      // not depend on a live profile or on the administrator viewing/retrying it.
      const actorName=(typeof state.actor.name === 'string' ? state.actor.name.trim() : '') || emailOf(state.actor.email);
      P.assert(actorName,'La identidad del solicitante requiere revisión institucional.','failed-precondition');
      const actor={id:caller.uid,name:actorName,email:emailOf(state.actor.email),role:state.actor.role || state.actor.baseRole};
      const job={operationId,requestHash,targetId:target.id,name:target.name,email:preview.identity.email,authIdentity:preview.identity,actorId:caller.uid,actor,reason,createdAt:now,status:'PENDING_AUTH',attempts:0,lastError:null};
      tx.update(db.doc('usuarios/'+target.id),{status:'Inactivo',deletedAt:now,deletionOperationId:operationId,revision:(target.revision??0)+1,updatedAt:now});
      tx.create(tombstone,{...job,profile:target});
      tx.create(emailRef,{targetId:target.id,operationId,createdAt:now});tx.create(uidRef,{targetId:target.id,operationId,createdAt:now});
      tx.create(db.doc('bitacora/baja_'+operationId),{module:'Usuarios',action:'BAJA_USUARIO_INICIADA',actorId:caller.uid,actor,user:actor.name,description:`${actor.name} solicitó la baja de ${target.name} (${preview.identity.email}). Acceso a SPAI bloqueado; Authentication pendiente.`,entity:'usuarios',entityId:target.id,reason,createdAt:now,operationId,source:'SERVIDOR',before:{status:target.status??null},after:{status:'Inactivo',deletedAt:now}});
      tx.create(db.doc('eventos_baja/'+operationId),{operationId,targetId:target.id,targetName:target.name,targetEmail:preview.identity.email,actorId:caller.uid,actor,reason,createdAt:now,status:'PENDING_AUTH',delivery:'NO_EMAIL'});
      tx.create(op,job);tx.set(state.fence,{revision:(state.lock.data()?.revision??0)+1});
      return operationId;
    });
  }
  async function process(operationId, retryCaller = null) {
    const op=db.doc('operaciones_baja/'+operationId),attemptId=randomUUID();
    const claimed=await db.runTransaction(async tx=>{
      const retryProfile=retryCaller ? await administrator(tx,retryCaller) : null;
      const snap=await tx.get(op);P.assert(snap.exists,'Baja no encontrada.','not-found');const job=snap.data();
      if(job.status==='COMPLETED'||job.leaseUntil>nowMillis())return {job,claimed:false};
      // Legacy pending jobs may recover only the snapshot already recorded at
      // initiation. Never infer a missing identity from today's user directory.
      const initial=job.actor ? null : (await tx.get(db.doc('bitacora/baja_'+operationId))).data();
      const actor=job.actor ?? (initial?.actorId===job.actorId && typeof initial.user==='string'
        ? {id:job.actorId,name:initial.user} : {id:job.actorId});
      const executor=retryCaller ? {kind:'ADMIN_RETRY',id:retryCaller.uid,name:retryProfile.name}
        : {kind:'SERVER',id:'user-deletion-worker'};
      const next={status:'PROCESSING_AUTH',leaseUntil:nowMillis()+30000,attemptId,actor,executor,attemptActorId:retryCaller?.uid??null,attempts:job.attempts+1};
      tx.update(op,next);tx.update(db.doc('bajas_usuarios/'+job.targetId),next);tx.update(db.doc('eventos_baja/'+operationId),next);
      return {job:{...job,...next},claimed:true};
    });
    if(!claimed.claimed)return publicResult(claimed.job);
    const job=claimed.job;let failure=null;
    try {
      let existing;
      try {existing=await authAdmin.getUser(job.authIdentity.uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
      if(existing){
        P.assert(emailOf(existing.email)===job.authIdentity.email && job.authIdentity.createdAt===existing.metadata.creationTime,'La identidad de Authentication cambió; requiere revisión.','failed-precondition');
        await authAdmin.revokeRefreshTokens(existing.uid);
        try {await authAdmin.deleteUser(existing.uid);} catch(e){if(e.code!=='auth/user-not-found')throw e;}
      }
      try {await authAdmin.getUser(job.authIdentity.uid);throw new Error('Authentication aún conserva la cuenta.');}catch(e){if(e.code!=='auth/user-not-found')throw e;}
    }catch(e){failure=String(e.code??'auth/processing-failed').slice(0,100);}
    return db.runTransaction(async tx=>{
      const snap=await tx.get(op),current=snap.data();if(current.attemptId!==attemptId)return publicResult(current);
      const now=new Date(nowMillis()).toISOString(),patch={status:failure?'PENDING_AUTH':'COMPLETED',lastError:failure,leaseUntil:0,updatedAt:now,...(!failure?{completedAt:now,authResult:'CONFIRMED_ABSENT'}:{})};
      tx.update(op,patch);tx.update(db.doc('bajas_usuarios/'+job.targetId),patch);tx.update(db.doc('eventos_baja/'+operationId),patch);
      tx.create(db.doc('intentos_baja/'+attemptId),{operationId,actorId:job.actorId,actor:job.actor,executor:job.executor,attempt:current.attempts,status:patch.status,error:failure,processedAt:now});
      if(!failure)tx.create(db.doc('bitacora/baja_auth_'+operationId),{module:'Usuarios',action:'BAJA_AUTH_COMPLETADA',actorId:job.actorId,actor:job.actor,executor:job.executor,description:`Baja de ${job.name} (${job.email}) solicitada por ${job.actor.name || 'solicitante sin identidad legible registrada'}. Authentication: ausencia de la cuenta confirmada.`,targetName:job.name,targetEmail:job.email,entity:'usuarios',entityId:job.targetId,operationId,reason:job.reason,authResult:patch.authResult,createdAt:now,source:'SERVIDOR'});
      return publicResult({...current,...patch});
    });
  }
  async function execute(caller,data) {
    P.assert(caller?.uid,'Inicia sesión.','unauthenticated');
    P.assert(data && ['prepare','confirm','retry','pending'].includes(data.action),'Operación inválida.','invalid-argument');
    if(data.action==='prepare')return prepare(caller,data);
    if(data.action==='confirm')return {result:await process(await begin(caller,data))};
    if(data.action==='retry'){
      const operationId=validId(data.operationId);
      await db.runTransaction(async tx=>{await administrator(tx,caller);const op=await tx.get(db.doc('operaciones_baja/'+operationId));P.assert(op.exists,'Baja no encontrada.','not-found');const tomb=await tx.get(db.doc('usuarios/'+op.data().targetId));P.assert(tomb.data()?.deletedAt && tomb.data().deletionOperationId===operationId,'La baja requiere revisión de integridad.','failed-precondition');});
      return {result:await process(operationId,caller)};
    }
    return db.runTransaction(async tx=>{await administrator(tx,caller);const jobs=await tx.get(db.collection('operaciones_baja').where('status','in',['PENDING_AUTH','PROCESSING_AUTH']).limit(201));P.assert(jobs.size<=200,'El seguimiento de bajas requiere consulta administrativa por lotes.','resource-exhausted');return {pending:jobs.docs.map(d=>publicResult(d.data()))};});
  }
  return {execute};
}
module.exports={createUserDeletionService};
