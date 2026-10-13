import assert from 'node:assert/strict';
import { doc, collection, getDocFromServer, getDocsFromServer, query, where, updateDoc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

// Invoked only by the guarded synthetic integration runner; no production setup.
export async function reviewTests({ db, P, clients, check, denied, command, read, rev, profile, createSecurityService, processNotification }) {
  const ref = (who, path) => doc(clients.get(who).db, path);
  const collections = ['usuarios','roles_personalizados','delegaciones','asignaciones_roles','revisiones_roles','mapeos_permisos'];
  const snapshots = async () => {
    // Drain already committed events before comparing. Rejections must create none.
    for (const event of (await db.collection('eventos_seguridad').get()).docs) await processNotification(db,event.id,true);
    const names = [...collections,'bitacora','eventos_seguridad','operaciones_seguridad','previews_permisos','seguridad','avisos_seguridad'];
    return Object.fromEntries(await Promise.all(names.map(async name => [name,(await db.collection(name).get()).docs.map(d=>({id:d.id,...d.data()}))])));
  };
  await check('CO-02 CUSTOM VIEW Asignaciones: consultas por programa/ciclo y toda escritura denegada', async () => {
    const scope=P.scope({programs:['ADM'],cycles:['27-1']});
    await command('r01-admin',{action:'saveRole',targetId:'r01-view-assignments',expectedRevision:0,value:{name:'Consulta de asignaciones',permissions:{asignaciones:'VIEW'},scope}});
    await db.doc('usuarios/r01-view').set(profile('r01-view'));
    await command('r01-admin',{action:'assignRole',targetId:'r01-view',expectedRevision:1,roleId:'r01-view-assignments',roleRevision:1});
    const own=ref('r01-view','asignaciones/r01-own');
    const data=(await getDocFromServer(own)).data();
    assert.ok(data);
    const rows=await getDocsFromServer(query(collection(clients.get('r01-view').db,'asignaciones'),where('program','==','ADM'),where('cycle','==','27-1')));
    assert.ok(rows.size>0); assert.ok(rows.docs.every(d=>d.data().program==='ADM'&&d.data().cycle==='27-1'));
    for(const path of ['asignaciones/r01-foreign','asignaciones/demo-asignacion-cerrada']) await denied(()=>getDocFromServer(ref('r01-view',path)));
    await denied(()=>getDocsFromServer(collection(clients.get('r01-view').db,'asignaciones')));
    for(const change of [{teacherName:'NO'},{studentEnrollments:'NO'},{status:'CARGADO_MOODLE'},{sharedGroups:['NO']}]) await denied(()=>updateDoc(own,change));
    await denied(()=>deleteDoc(own));
    assert.equal((await db.doc('asignaciones/r01-view-create').get()).exists,false);
    await denied(()=>setDoc(ref('r01-view','asignaciones/r01-view-create'),{...data,status:'EN_CAPTURA',createdBy:'r01-view'}),'permission-denied',undefined,'create');
    await denied(()=>command('r01-view',{action:'saveRole',targetId:'forbidden'}));
    assert.deepEqual(await read('asignaciones/r01-own'),data);
  });
  await check('CO-02 excepción académica no se extiende al auxiliar VIEW aun con capacidad sensible', async () => {
    const result=await command('r01-admin',{action:'grantDelegation',targetId:'r01-aux',expectedRevision:await rev('usuarios/r01-aux'),value:{permissions:{asignaciones:'VIEW'},capabilities:['OPERATE_EXCEPTIONAL_CHANGE'],scope:{programs:['ADM'],cycles:['27-1'],fields:['*']}}});
    assert.ok((await getDocFromServer(ref('r01-aux','asignaciones/r01-own'))).exists());
    await denied(()=>getDocFromServer(ref('r01-aux','asignaciones/r01-foreign')));
    await denied(()=>updateDoc(ref('r01-aux','asignaciones/r01-foreign'),{studentEnrollments:'NO'}));
    await denied(()=>deleteDoc(ref('r01-aux','asignaciones/r01-own')));
    await command('r01-admin',{action:'revokeDelegation',targetId:result.delegationId,expectedRevision:1});
  });
  await check('Transición: siete días exactos de servidor y preview anterior no confirma al vencer', async () => {
    const target=profile('r01-legacy'); delete target.permissionSchemaVersion; delete target.baseRole;
    target.permissions={grupos:'VIEW',docentes:'NONE'}; target.access={asignaciones:true,docentes:true,grupos:false};
    await db.doc('usuarios/r01-legacy').set(target);
    let clock=Date.parse('2026-01-01T00:00:00Z');
    const service=createSecurityService(db,{nowMillis:()=>clock});
    const run=data=>service.execute({uid:'r01-admin'},{operationId:crypto.randomUUID(),reason:'Ensayo de tiempo determinista',targetId:'r01-legacy',...data});
    await run({action:'approveMapping',expectedRevision:1,baseRole:'COORDINACION_ACADEMICA'});
    const stored=await read('usuarios/r01-legacy'); const legacy=stored.legacyAuthorization; const mapping=await read('mapeos_permisos/r01-legacy');
    assert.equal(legacy.issuedAtMillis,clock); assert.equal(legacy.expiresAtMillis,clock+7*86400000);
    assert.equal(stored.updatedAt,new Date(clock).toISOString());
    assert.equal(P.effective(stored,null,{mapping,nowMillis:legacy.expiresAtMillis-1}).permissions.asignaciones,'EDIT');
    assert.equal(P.effective(stored,null,{mapping,nowMillis:legacy.expiresAtMillis}).active,false);
    const preview=(await run({action:'previewMigration'})).preview;
    clock=legacy.expiresAtMillis;
    const before=await snapshots();
    await denied(()=>run({action:'applyMigration',previewId:preview.previewId}),'failed-precondition','LEGACY_AUTHORIZATION_EXPIRED');
    assert.deepEqual(await snapshots(),before);
    const fresh=(await run({action:'previewMigration'})).preview;
    await run({action:'applyMigration',previewId:fresh.previewId});
    const migrated=await read('usuarios/r01-legacy');
    assert.equal(migrated.permissions.grupos,'VIEW'); assert.equal(migrated.permissions.docentes,'NONE');
    assert.equal(P.effective(migrated).permissions.grupos,'VIEW');
  });
  await check('Rules y callables: autorización temporal vigente, vencida, cambiada o revocada', async () => {
    const target=profile('r01-legacy'); delete target.permissionSchemaVersion; delete target.baseRole;
    target.permissions={grupos:'VIEW',docentes:'NONE'}; target.access={asignaciones:true};
    await db.doc('usuarios/r01-legacy').set(target);
    await command('r01-admin',{action:'approveMapping',targetId:'r01-legacy',expectedRevision:1,baseRole:'COORDINACION_ACADEMICA'});
    const stored=await read('usuarios/r01-legacy'); const mapping=await read('mapeos_permisos/r01-legacy');
    const assignmentRef=ref('r01-legacy','asignaciones/r01-own');
    assert.ok((await getDocFromServer(assignmentRef)).exists());
    await updateDoc(assignmentRef,{teacherName:'TEMPORAL VIGENTE'});
    await denied(()=>getDocFromServer(ref('r01-legacy','docentes/r01-own')));
    // Prepare the SDK batch while authorized. Fix the stored deadline in the past,
    // rather than sleeping or altering the emulator clock; commit resolves Rules again.
    const prepared=writeBatch(clients.get('r01-legacy').db); prepared.update(assignmentRef,{teacherName:'NO DESPUÉS'});
    await db.doc('usuarios/r01-legacy').update({'legacyAuthorization.expiresAtMillis':1});
    const before=await read('asignaciones/r01-own');
    await denied(()=>prepared.commit()); await denied(()=>getDocFromServer(assignmentRef));
    for(const expired of [true,false]) {
      if(!expired) await db.doc('usuarios/r01-legacy').set(stored);
      await denied(()=>httpsCallable(clients.get('r01-legacy').functions,'securityDirectory')({}));
      await denied(()=>command('r01-legacy',{action:'saveRole',targetId:'never'}));
      const p=await read('usuarios/r01-legacy');
      const linked=await httpsCallable(clients.get('r01-legacy').functions,'syncUserProfileByEmail')({});
      assert.equal(linked.data.synced,true); assert.deepEqual(await read('usuarios/r01-legacy'),p);
    }
    assert.deepEqual(await read('asignaciones/r01-own'),before);
    for(const change of [{revision:99},{status:'Inactivo'},{identityAliasOf:'other'}]) {
      await db.doc('usuarios/r01-legacy').set({...stored,...change}); await denied(()=>getDocFromServer(assignmentRef));
    }
    await db.doc('usuarios/r01-legacy').set(stored);
    for(const change of [{revision:99},{status:'REVOKED'},{baseRole:'ALTA_DOCENTES'}]) {
      await db.doc('mapeos_permisos/r01-legacy').set({...mapping,...change}); await denied(()=>getDocFromServer(assignmentRef));
    }
    await db.doc('mapeos_permisos/r01-legacy').set(mapping);
    const preview=(await command('r01-admin',{action:'previewMigration',targetId:'r01-legacy'})).preview;
    await command('r01-admin',{action:'approveMapping',targetId:'r01-legacy',expectedRevision:stored.revision,baseRole:'ALTA_DOCENTES'});
    const unchanged=await snapshots();
    await denied(()=>command('r01-admin',{action:'applyMigration',targetId:'r01-legacy',previewId:preview.previewId}),'aborted','MIGRATION_PREVIEW_OBSOLETE');
    assert.deepEqual(await snapshots(),unchanged);
  });
  await check('Límite 199/200/201: operaciones críticas, directorio y rechazo totalmente atómico', async () => {
    const added=[];
    const put=async(path,data)=>{await db.doc(path).set(data);added.push(path);};
    const count=async()=>(await Promise.all(collections.map(c=>db.collection(c).get()))).reduce((sum,s)=>sum+s.size,0);
    try {
      await put('usuarios/r01-bound-helper',{...profile('r01-bound-helper','ADMIN_OPERATIVO'),delegationId:'r01-bound-grant'});
      await put('usuarios/r01-bound-user',profile('r01-bound-user'));
      await put('delegaciones/r01-bound-grant',{userId:'r01-bound-helper',status:'ACTIVE',revision:1});
      await put('usuarios/r01-bound-helper2',{...profile('r01-bound-helper2','ADMIN_OPERATIVO'),delegationId:'r01-bound-grant2'});
      await put('delegaciones/r01-bound-grant2',{userId:'r01-bound-helper2',status:'ACTIVE',revision:1});
      await put('asignaciones_roles/r01-bound-role',{userId:'r01-bound-user',status:'ACTIVE',assignedByDelegationId:'r01-bound-grant',permissions:P.levels(),capabilities:[],scope:P.scope(),revision:1});
      for(let n=await count();n<199;n++) await put(`mapeos_permisos/r01-padding-${n}`,{synthetic:true,status:'RETIRED'});
      assert.equal(await count(),199);
      await command('r01-admin',{action:'previewMigration',targetId:'r01-bound-user'});
      assert.equal(await count(),199,'previews, auditoría, eventos e idempotencia no cuentan');
      await put('mapeos_permisos/r01-padding-200',{synthetic:true}); assert.equal(await count(),200);
      await command('r01-admin',{action:'deleteUser',targetId:'r01-bound-user',expectedRevision:1});
      assert.equal((await read('usuarios/r01-bound-user')).status,'Inactivo');
      const revoke=await command('r01-admin',{action:'revokeDelegation',targetId:'r01-bound-grant',expectedRevision:1});
      added.push('revisiones_roles/'+revoke.reviewIds[0]);
      assert.equal(await count(),201,'el límite se comprueba antes; una revisión nueva cruza el umbral');
      const before=await snapshots();
      for(const data of [
        {action:'revokeDelegation',targetId:'r01-bound-grant2',expectedRevision:1},
        {action:'deleteUser',targetId:'r01-view',expectedRevision:await rev('usuarios/r01-view')},
        {action:'resolveReview',targetId:revoke.reviewIds[0],expectedRevision:1,decision:'KEEP'},
      ]) await denied(()=>command('r01-admin',data),'resource-exhausted','límite local de 200 documentos de seguridad');
      assert.deepEqual(await snapshots(),before);
      const directory=(await httpsCallable(clients.get('r01-admin').functions,'securityDirectory')({})).data;
      assert.ok(directory.usuarios.some(u=>u.id==='r01-bound-user'),'directorio no cuenta mapeos ni suma colecciones');
      const roles=(await db.collection('roles_personalizados').get()).size;
      for(let n=roles;n<200;n++) await put(`roles_personalizados/r01-padding-${n}`,{name:'Ficticio',status:'RETIRED'});
      assert.equal((await httpsCallable(clients.get('r01-admin').functions,'securityDirectory')({})).data.roles_personalizados.length,200);
      await put('roles_personalizados/r01-padding-201',{name:'Ficticio',status:'RETIRED'});
      const excess=await snapshots();
      await denied(()=>httpsCallable(clients.get('r01-admin').functions,'securityDirectory')({}),'resource-exhausted','Directorio excede el límite local.');
      assert.deepEqual(await snapshots(),excess);
    } finally { for(const path of added) await db.doc(path).delete(); }
  });
}
