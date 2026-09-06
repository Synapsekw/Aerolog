import test from 'node:test';
import assert from 'node:assert/strict';
import {assetSchema,batterySchema} from '../lib/domain/models';
test('imported equipment preserves unknown readiness measurements',()=>{
 const asset=assetSchema.parse({id:'source-1',name:'Imported aircraft',serial:'',category:'Aircraft',status:'Unverified',hours:null,next:null,intervalHours:null,notes:''});
 assert.equal(asset.hours,null);assert.equal(asset.next,null);
 const battery=batterySchema.parse({id:'source-b',model:'Imported battery',aircraft:'Unassigned',cycles:6,health:null,temp:null,status:'Unverified',notes:''});
 assert.equal(battery.health,null);assert.equal(battery.temp,null);
 assert.equal(batterySchema.safeParse({...battery,health:105}).success,false);
});
