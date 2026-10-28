import {fixtures} from '../../local/fixtures.mjs';
export function fixtureDocuments(){
 const all=fixtures(),get=p=>structuredClone(all.find(d=>d.path===p).data);
 const academic=get('usuarios/demo-coord-a'),system=get('usuarios/demo-sistemas'),aux=get('usuarios/demo-auxiliar');
 const assignment=get('asignaciones/demo-asignacion-a');assignment.createdBy='demo-coord-a';
 const special={...assignment,assignmentType:'ESPECIAL',special:true,group:'27-1 ADM 11 C.A',sharedGroups:[],sharedPrograms:[]};
 return [
  {path:'usuarios/demo-coord-a',data:academic},{path:'usuarios/demo-sistemas',data:system},
  {path:'usuarios/diag-custom',data:{...academic,authUid:'diag-custom',baseRole:'CUSTOM',scope:{...academic.scope,cycles:['27-1']}}},
  {path:'usuarios/diag-aux',data:{...aux,authUid:'diag-aux',delegationId:'diag-grant'}},
  {path:'delegaciones/diag-grant',data:{userId:'diag-aux',status:'ACTIVE',permissions:{asignaciones:'EDIT'},capabilities:[],scope:{programs:['ADM'],cycles:['27-1'],teachers:[],fields:['studentEnrollments']}}},
  {path:'asignaciones/diag-ordinary',data:assignment},{path:'asignaciones/diag-special',data:special},
  {path:'asignaciones/diag-foreign',data:{...special,program:'DER',group:'27-1 DER 11 C.A'}},
  {path:'asignaciones/diag-outside',data:{...special,cycle:'99-9'}},
  {path:'grupos/27_1_ADM_11_01',data:{fullGroup:'27-1 ADM 11 01',cycleCode:'27-1',programAbbreviation:'ADM',status:'Activo',modality:'Escolarizado',section:'01'}},
  ...['ADM','DER'].map(program=>({path:`grupos/27_1_${program}_11_C_A`,data:{fullGroup:`27-1 ${program} 11 C.A`,cycleCode:'27-1',programAbbreviation:program,status:'Activo',modality:'Virtual',section:'C.A'}})),
  {path:'docentes/demo-docente-1',data:get('docentes/demo-docente-1')},
  {path:'ciclo_control/operativo',data:{state:'READY',cycleId:'demo-27-1',code:'27-1',status:'Captura',specialsEnabled:false,specialGroups:['27-1 ADM 11 C.A','27-1 DER 11 C.A']}},
  {path:'ciclos/demo-27-1',data:{code:'27-1',status:'Captura',revision:1,specialsEnabled:false}}
 ];
}
