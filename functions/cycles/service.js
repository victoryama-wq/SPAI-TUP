'use strict';
const {createHash} = require('node:crypto');
const P = require('../security/policy');
const OPERATIVE = ['Preparacion', 'Captura', 'Captura cerrada'];
const TRANSITIONS = {start:['Preparacion','Captura'], closeCapture:['Captura','Captura cerrada'], reopen:['Captura cerrada','Captura'], close:['Captura cerrada','Cerrado']};
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
function createCycleService(db, {nowMillis=Date.now}={}) {
  async function readActor(tx, auth) {
    P.assert(auth?.uid, 'Inicia sesión.', 'unauthenticated');
    const profile = (await tx.get(db.doc(`usuarios/${auth.uid}`))).data();
    const grant = profile?.delegationId ? (await tx.get(db.doc(`delegaciones/${profile.delegationId}`))).data() : null;
    const mapping = profile?.permissionSchemaVersion !== 2 ? (await tx.get(db.doc(`mapeos_permisos/${auth.uid}`))).data() : null;
    const effective = () => P.effective(profile, grant, {mapping, nowMillis:nowMillis()});
    P.assert(effective().active, 'Permiso revocado o vencido.');
    return {profile,effective};
  }
  async function readCycles(tx) {
    const fence = db.doc('ciclo_control/operativo');
    await tx.get(fence);
    const snapshot = await tx.get(db.collection('ciclos'));
    const cycles = snapshot.docs.map(d=>({...d.data(),id:d.id}));
    const groups = (await tx.get(db.collection('grupos'))).docs.map(d=>d.data());
    return {fence,cycles,groups,current:cycles.filter(c=>OPERATIVE.includes(c.status))};
  }
  function context(cycles, groups) {
    const current=cycles.filter(c=>OPERATIVE.includes(c.status));
    return {state:current.length>1?'INCONSISTENT':current.length?'READY':'NONE', cycleId:current.length===1?current[0].id:null, code:current.length===1?current[0].code:null, status:current.length===1?current[0].status:null, specialsEnabled:current.length===1 && current[0].specialsEnabled===true, specialGroups:current.length===1 ? groups.filter(g=>g.cycleCode===current[0].code && g.status==='Activo' && !['Escolarizado','Ejecutivo'].includes(g.modality) && /C\.A\.?$/i.test(g.section||'')).map(g=>g.fullGroup) : []};
  }
  // Only derived control metadata is initialized. Never edits/migrates cycle records.
  async function inspect(auth) {
    return db.runTransaction(async tx=>{
      const {effective}=await readActor(tx,auth);
      const {fence,cycles,groups}=await readCycles(tx);
      const actor=effective();
      P.assert(actor.active && ['ciclos','asignaciones','dashboard','docentes','grupos'].some(k=>P.RANK[actor.permissions[k]]>0),'Sin permiso de consulta de ciclos.');
      const result=context(cycles,groups); tx.set(fence,result); return {state:result.state,cycleId:result.cycleId,code:result.code};
    });
  }
  async function execute(auth,data) {
    P.assert(data && validId(data.operationId), 'Identificador de operación inválido.', 'invalid-argument');
    P.assert(data.action==='create' || data.action==='specials' || data.action==='schedule' || Object.hasOwn(TRANSITIONS,data.action),'Operación de ciclo no admitida.','invalid-argument');
    return db.runTransaction(async tx=>{
      const {profile,effective}=await readActor(tx,auth);
      const {fence,cycles,current,groups}=await readCycles(tx);
      const opId=`${auth.uid}_${data.operationId}`;
      const op=db.doc(`operaciones_ciclo/${opId}`);
      const previous=await tx.get(op);
      const existing=cycles.find(c=>c.id===data.cycleId);
      const code=data.action==='create'?String(data.payload?.code??'').trim():existing?.code;
      const authorize=()=>{
        const actor=effective(); P.requireCapability(actor,'MANAGE_CYCLES');
        P.assert(actor.permissions.ciclos==='EDIT' && P.subset([code],actor.scope.cycles),'El ciclo está fuera de la facultad o ámbito concedido.');
      };
      authorize();
      if(previous.exists) { P.assert(previous.data().requestHash===hash(data),'Identificador reutilizado con otra petición.','already-exists'); return previous.data().result; }
      P.assert(current.length<=1,'CICLO_INCONSISTENTE: hay varios ciclos operativos. No se modificaron datos.','failed-precondition');
      const now=new Date(nowMillis()).toISOString();
      let next,ref;
      if(data.action==='create') {
        P.assert(current.length===0,'Ya existe un ciclo operativo.','failed-precondition');
        P.assert(/^\d{2}-\d$/.test(code),'Código inválido.','invalid-argument');
        P.assert(!cycles.some(c=>c.code?.toLowerCase()===code.toLowerCase()),'Código de ciclo existente.','already-exists');
        const label=String(data.payload?.label??'').trim(); P.assert(label.length>=3 && label.length<=160,'Indica el nombre del ciclo.','invalid-argument');
        ref=db.doc(`ciclos/${data.operationId}`);
        P.assert(!cycles.some(c=>c.id===ref.id),'Identificador de ciclo existente.','already-exists');
        next={id:ref.id,code,label,notes:String(data.payload?.notes??'').trim(),status:'Preparacion',revision:1,specialsEnabled:false,createdAt:now,captureStartedAt:null,captureClosedAt:null,closedAt:null,tentativeCaptureCloseAt:data.payload?.tentativeCaptureCloseAt||null};
      } else {
        P.assert(existing,'Ciclo inexistente.','not-found');
        P.assert(Number.isSafeInteger(data.expectedRevision) && data.expectedRevision===(existing.revision??0),'CONFLICTO_VERSION: el ciclo cambió. Actualiza antes de confirmar.','aborted');
        P.assert(existing.status!=='Cerrado','Un ciclo cerrado es histórico; no admite operaciones.','failed-precondition');
        ref=db.doc(`ciclos/${existing.id}`); next={...existing,revision:(existing.revision??0)+1};
        if(data.action==='specials') {
          P.assert(existing.status==='Captura cerrada' && typeof data.enabled==='boolean','Especiales solo puede habilitarse o deshabilitarse en Captura cerrada.','failed-precondition');
          P.assert(existing.specialsEnabled!==data.enabled,'El valor de Especiales no cambia.','failed-precondition');
          next.specialsEnabled=data.enabled;
        } else if(data.action==='schedule') next.tentativeCaptureCloseAt=data.date||null;
        else {
          const [from,to]=TRANSITIONS[data.action]; P.assert(existing.status===from,'Transición de ciclo no permitida.','failed-precondition');
          if(data.action==='reopen') P.assert(typeof data.reason==='string' && data.reason.trim().length>=4 && data.reason.trim().length<=1000,'Indica un motivo de reapertura (4–1000 caracteres).','invalid-argument');
          next.status=to; next.specialsEnabled=false;
          if(to==='Captura') {next.captureStartedAt=existing.captureStartedAt||now;next.captureClosedAt=null;}
          if(to==='Captura cerrada') next.captureClosedAt=now;
          if(to==='Cerrado') next.closedAt=now;
        }
      }
      if(next.tentativeCaptureCloseAt) P.assert(/^\d{4}-\d{2}-\d{2}$/.test(next.tentativeCaptureCloseAt) && !Number.isNaN(Date.parse(next.tentativeCaptureCloseAt)) && new Date(next.tentativeCaptureCloseAt).toISOString().slice(0,10)===next.tentativeCaptureCloseAt && next.tentativeCaptureCloseAt>=(next.captureStartedAt||next.createdAt).slice(0,10),'La fecha de cierre debe ser válida y posterior al inicio.','invalid-argument');
      authorize(); // Recheck wall-clock expiry after all awaited reads.
      next.updatedAt=now; next.updatedBy=auth.uid;
      const result={cycleId:ref.id,revision:next.revision,status:next.status,operationId:data.operationId};
      const event={actorId:auth.uid,actorName:profile.name||'',actorArea:profile.area||'',cycleId:ref.id,cycle:code,action:data.action,previous:existing||null,next,createdAt:now,reason:String(data.reason||'').trim(),operationId:data.operationId};
      if(existing) tx.set(ref,next); else tx.create(ref,next);
      tx.set(fence,context([...cycles.filter(c=>c.id!==ref.id),next],groups));
      tx.create(db.doc(`bitacora/ciclo_${opId}`),{...event,module:'Ciclos',entity:'ciclos',entityId:ref.id,description:`${data.action}: ${code}`,source:'SERVIDOR',integrity:'VERIFICADO'});
      tx.create(db.doc(`eventos_ciclo/${opId}`),{...event,state:'PENDIENTE',delivery:'SIMULATED_ONLY'});
      tx.create(op,{requestHash:hash(data),result,createdAt:now});
      return result;
    });
  }
  return {execute,inspect};
}
module.exports={createCycleService,OPERATIVE,TRANSITIONS};
