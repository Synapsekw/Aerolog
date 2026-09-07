export type EquipmentIdentity = {kind:'asset'|'battery';id:string};
export type EquipmentAlias = {kind:'asset'|'battery';source_id:string;canonical_id:string};
/** Resolve within one already-authorized organization's aliases. Never rewrite input. */
export function canonicalEquipment(identity:EquipmentIdentity,aliases:EquipmentAlias[]):EquipmentIdentity {
 const seen=new Set<string>();let id=identity.id;
 while(true){
  if(seen.has(id))throw Error('Equipment identity cycle requires repair.');
  seen.add(id);
  const matches=aliases.filter(a=>a.kind===identity.kind&&a.source_id===id);
  if(matches.length>1)throw Error('Equipment identity has conflicting canonical records.');
  if(!matches.length)return {...identity,id};
  id=matches[0].canonical_id;
 }
}
export function equipmentIdentityFamily(identity:EquipmentIdentity,aliases:EquipmentAlias[]){
 const canonical=canonicalEquipment(identity,aliases);
 const ids=new Set([canonical.id,identity.id]);
 for(const alias of aliases.filter(a=>a.kind===identity.kind)){
  if(canonicalEquipment({kind:alias.kind,id:alias.source_id},aliases).id===canonical.id)ids.add(alias.source_id);
 }
 return {canonical,ids:[...ids].sort()};
}
