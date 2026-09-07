import test from 'node:test';import assert from 'node:assert/strict';import {canonicalEquipment,equipmentIdentityFamily,type EquipmentAlias} from '../lib/domain/equipment-identity';
test('canonical equipment resolves chains without merging kinds or changing source identities',()=>{
 const aliases:EquipmentAlias[]=[{kind:'asset',source_id:'a',canonical_id:'b'},{kind:'asset',source_id:'b',canonical_id:'c'},{kind:'battery',source_id:'a',canonical_id:'pack'}];
 const source={kind:'asset' as const,id:'a'};
 assert.deepEqual(canonicalEquipment(source,aliases),{kind:'asset',id:'c'});assert.equal(source.id,'a');
 assert.deepEqual(equipmentIdentityFamily(source,aliases).ids,['a','b','c']);
 assert.equal(canonicalEquipment({kind:'battery',id:'a'},aliases).id,'pack');
 assert.equal(canonicalEquipment({kind:'asset',id:'unrelated'},aliases).id,'unrelated');
});
test('canonical equipment rejects cycles and conflicting identity mappings',()=>{
 assert.throws(()=>canonicalEquipment({kind:'asset',id:'a'},[{kind:'asset',source_id:'a',canonical_id:'b'},{kind:'asset',source_id:'b',canonical_id:'a'}]),/cycle/);
 assert.throws(()=>canonicalEquipment({kind:'asset',id:'a'},[{kind:'asset',source_id:'a',canonical_id:'b'},{kind:'asset',source_id:'a',canonical_id:'c'}]),/conflicting/);
});

test('current inventory excludes merged sources while source history remains intact',async()=>{
 const {canonicalInventory}=await import('../lib/domain/equipment-identity');
 const records=[{id:'a'},{id:'b'},{id:'c'}],aliases:EquipmentAlias[]=[{kind:'asset',source_id:'a',canonical_id:'b'},{kind:'asset',source_id:'b',canonical_id:'c'}];
 assert.deepEqual(canonicalInventory('asset',records,aliases),[{id:'c'}]);assert.deepEqual(canonicalInventory('battery',records,aliases),records);assert.equal(records.length,3);
});
