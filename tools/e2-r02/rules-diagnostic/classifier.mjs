// Narrow, evidence-based classifier. Never accepts permission-denied alone.
export function classify({expected,operation,response,coverage,positive,requestBound=true}) {
 const message=response.body?.error?.message||response.body?.message||'';
 const causes=[];const visit=n=>{if(!n||typeof n!=='object')return;for(const [k,v] of Object.entries(n)){if(k==='causeMessage'&&v)causes.push(v);visit(v);}};visit(coverage);
 if(causes.length)return {status:'FAIL',reason:'Explicit Rules execution defect',causes};
 if(!requestBound)return {status:'INCONCLUSIVE_EVALUATOR',reason:'Trace is not bound to the exact request'};
 if(expected==='allow')return {status:response.status===200?'PASS':'FAIL',reason:response.status===200?'Authorized exact operation':'Expected authorization rejected',causes};
 if(response.status===200)return {status:'FAIL',reason:'Forbidden operation authorized'};
 if(response.status!==403||!positive?.status||positive.status!=='PASS')return {status:'INCONCLUSIVE_EVALUATOR',reason:'Missing expected denial or authorized control'};
 if(/maximum of|Null value|UNAVAILABLE|INTERNAL|undefined on object|not bound/i.test(message))return {status:'FAIL',reason:'Known execution/availability diagnostic',message};
 const generic=[...message.matchAll(/evaluation error at L(\d+):(\d+) for '(\w+)' @ L(\d+)/g)];
 const explicit=[...message.matchAll(/false for '(\w+)' @ L(\d+)/g)];
 const residual=message.replace(/7 PERMISSION_DENIED:\s*/g,'').replace(/evaluation error at L\d+:\d+ for '\w+' @ L\d+/g,'').replace(/false for '\w+' @ L\d+/g,'').replace(/[\s,]/g,'');
 if(residual||!explicit.some(x=>x[1]===operation))return {status:'INCONCLUSIVE_EVALUATOR',reason:'Unrecognized or mismatched diagnostic',message};
 const roots=coverage.report||[];
 for(const g of generic){const node=roots.find(n=>n.sourcePosition?.line===Number(g[1])&&n.sourcePosition?.column===Number(g[2]));
  if(!node?.values?.some(v=>v.count>0&&v.value?.boolValue===false)||node.values.some(v=>v.value?.boolValue===true))return {status:'INCONCLUSIVE_EVALUATOR',reason:'No conclusive false root for generic diagnostic',position:g[0]};
 }
 return {status:'PASS',reason:generic.length?'Expected denial with exact false allow-root, positive control and no execution cause; generic diagnostic matches the controlled minimal comparison':'Explicit contractual false denial with authorized control',genericRoots:generic.length,causes};
}
export function classifyAtomic(evidence) {
 const ordinary=classify({...evidence,operation:'update'});
 if(ordinary.status!=='INCONCLUSIVE_EVALUATOR'||ordinary.reason!=='No conclusive false root for generic diagnostic')return ordinary;
 const writes=evidence.request?.body?.writes,components=evidence.components;
 if(!writes||!components||writes.length!==components.length)return ordinary;
 for(let i=0;i<writes.length;i++)if(JSON.stringify(writes[i])!==JSON.stringify(components[i].request?.body?.writes?.[0])||classify({...components[i],expected:'deny',positive:evidence.positive}).status!=='PASS')return ordinary;
 const message=evidence.response.body?.error?.message||'';
 const positions=[...message.matchAll(/evaluation error at L(\d+):(\d+) for '(\w+)' @ L(\d+)/g)];
 const roots=evidence.coverage.report||[];
 if(!positions.some(g=>roots.some(n=>n.sourcePosition.line===+g[1]&&n.sourcePosition.column===+g[2]&&n.values?.some(v=>v.value?.boolValue===false))))return ordinary;
 for(const g of positions)if(!components.some(c=>c.coverage.report?.some(n=>n.sourcePosition.line===+g[1]&&n.sourcePosition.column===+g[2]&&n.values?.some(v=>v.value?.boolValue===false))))return ordinary;
 return {status:'PASS',reason:'Atomic denial: exact constituent writes each conclusively denied; batch has false allow-root and remaining deferred roots match the reproduced short-circuit diagnostic; positive batch succeeds',componentCount:components.length};
}
