import test from 'node:test';
import assert from 'node:assert/strict';
import { compareBoundary } from '../lib/operations/flight-boundary';
const square: [number,number][]=[[55,25],[56,25],[56,26],[55,26]];
test('boundary comparison counts samples and includes boundary edges',()=>{
 assert.deepEqual(compareBoundary(square,[[55.5,25.5],[55,25],[57,25.5]]),{available:true,outside:1,total:3});
 assert.deepEqual(compareBoundary([...square].reverse(),[[55.5,25.5],[55,25],[57,25.5]]),{available:true,outside:1,total:3});
});
test('comparison refuses missing, degenerate and unsupported geographic data',()=>{
 for(const polygon of [[],[[1,1],[2,2],[3,3]],[[179,0],[-179,0],[-179,1]]]) assert.equal(compareBoundary(polygon as [number,number][],[[55,25],[56,26]]).available,false);
 assert.equal(compareBoundary(square,[[55,25]]).available,false);
});
