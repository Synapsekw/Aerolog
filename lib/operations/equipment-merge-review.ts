import type {ReportRecord} from '@/lib/reports/flight-report';
type Identity={kind:'asset'|'battery';id:string};
export function equipmentMergeReview(records:ReportRecord[],keep:Identity,duplicate:Identity){
 if(keep.kind!==duplicate.kind||keep.id===duplicate.id)throw Error('Choose two different records of the same equipment kind.');
 const a=records.find(r=>r.kind===keep.kind&&r.id===keep.id),b=records.find(r=>r.kind===duplicate.kind&&r.id===duplicate.id);
 if(!a||!b)throw Error('Both equipment records must belong to this organization.');
 const fields=['name','sourceName','category','serial','manufacturer','productModel','model','firmware','status','hours','cycles','health','temp','storageSiteId','source','externalId'];
 const differences=fields.map(field=>({field,keep:a.data[field]??null,duplicate:b.data[field]??null})).filter(r=>r.keep!==r.duplicate);
 const conflicts:string[]=[];
 if(a.kind==='asset'&&a.data.category!==b.data.category)conflicts.push('Different equipment categories');
 if(a.data.serial&&b.data.serial&&a.data.serial.trim()!==b.data.serial.trim())conflicts.push('Different recorded serial numbers');
 function references(target:ReportRecord){
  const {kind,id,data}=target,name=data.name;
  const plans=records.filter(r=>r.kind==='inspection_plan'&&r.data.targetKind===kind&&r.data.targetId===id).map(r=>r.id);
  return records.filter(r=>{
   const d=r.data;
   const typed=(x:any)=>x?.kind===kind&&x?.id===id;
   if(r.kind==='flight')return kind==='battery'?d.battery===id||d.batteryIds?.includes(id):d.aircraftId===id||d.equipmentIds?.includes(id)||(!d.aircraftId&&name&&d.aircraft===name);
   if(r.kind==='mission')return d.equipment?.includes(id)||(kind==='asset'&&name&&(d.aircraft===name||d.additionalAircraft?.includes(name)||d.equipment?.includes(name)))||d.kitSnapshots?.some((k:any)=>k.items?.some(typed));
   if(r.kind==='kit')return d.items?.some(typed);
   if(r.kind==='service')return d.targetId?d.targetKind===kind&&d.targetId===id:kind==='asset'&&name&&d.asset===name;
   if(r.kind==='inspection_event')return plans.includes(d.planId);
   if(r.kind==='battery_reading')return kind==='battery'&&d.batteryId===id;
   if(r.kind==='battery_event')return kind==='battery'&&d.battery===id;
   if(r.kind==='crew')return kind==='asset'&&d.authorizedAircraftIds?.includes(id);
   if(r.kind==='document')return d.targetId===id&&d.targetKind===kind;
   return d.targetKind===kind&&d.targetId===id||d.equipment?.some?.(typed);
  }).map(r=>({kind:r.kind,id:r.id,revision:r.revision,status:r.data.status||'',name:r.data.name||r.data.task||r.data.title||r.id}));
 }
 return {keep:a,duplicate:b,differences,conflicts,keepReferences:references(a),duplicateReferences:references(b)};
}
