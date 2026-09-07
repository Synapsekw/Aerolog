import test from 'node:test';import assert from 'node:assert/strict';import {serviceSchema} from '../lib/domain/models';
test('service costs preserve unknown versus zero and require currency for known amounts',()=>{
 const service={id:'s',asset:'a',task:'Inspection',due:'2026-09-07',status:'Scheduled',technician:'t'};
 assert.equal(serviceSchema.parse(service).cost,undefined);
 assert.equal(serviceSchema.parse({...service,cost:null}).cost,null);
 assert.equal(serviceSchema.parse({...service,cost:0,currency:'AED'}).cost,0);
 assert.equal(serviceSchema.parse({...service,cost:123.456,currency:'KWD'}).cost,123.456);
 assert.equal(serviceSchema.safeParse({...service,cost:0}).success,false);
 assert.equal(serviceSchema.safeParse({...service,cost:-1,currency:'AED'}).success,false);
});
