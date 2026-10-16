import {auxiliaryFixture} from './auxiliary-fixture.mjs';
export async function accessFixture(db,{programs=['*'],level='VIEW'}={}) {
 const fixture=await auxiliaryFixture(db,{level});
 const grant={...fixture.grant,permissions:{bitacora:level,solicitudes:level,nomenclaturas:'VIEW'},scope:{programs,cycles:['*'],teachers:[],fields:['*']}};
 await db.doc('delegaciones/aux-regression').set(grant);
 for(const [id,owner] of [['own','demo-auxiliar'],['foreign','demo-coord-a']])await fixture.put('solicitudes_sistemas/access-'+id,{type:'ALTA_GRUPO',title:'Solicitud '+id,detail:'ACCESS '+id,cycle:'27-1',requestedBy:owner,requestedByName:owner,requestedByRole:'Ficticio',requestedByPrograms:['ADM'],status:'PENDIENTE',systemResponse:'',createdAt:'2026-10-16T00:00:00Z',updatedAt:'2026-10-16T00:00:00Z'});
 await fixture.put('bitacora/access-event',{module:'Solicitudes',action:'PRUEBA',description:'ACCESS evento ficticio',user:'Ficticio',userRole:'Ficticio',entity:'solicitudes_sistemas',entityId:'access-own',metadata:{},createdAt:'2026-10-16T00:00:00Z',source:'SERVIDOR',integrity:'VERIFICADO_SERVIDOR'});
 return {...fixture,grant};
}
