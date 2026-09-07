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
test('closed rings and redundant consecutive points preserve results without mutating input',()=>{
 const ring:[number,number][]=[...square,square[3],square[0]];
 const before=JSON.stringify(ring);
 assert.deepEqual(compareBoundary(ring,[[55.5,25.5],[57,25.5]]),{available:true,outside:1,total:2});
 assert.equal(JSON.stringify(ring),before);
});
test('self crossings, repeated nonadjacent vertices and overlapping edges are unavailable',()=>{
 const polygons:[number,number][][]=[
  [[0,0],[3,2],[0,3],[2,0]],
  [[0,0],[2,0],[2,2],[0,0],[0,2]],
  [[0,0],[3,0],[1,0],[1,2],[0,2]],
 ];
 for(const polygon of polygons) assert.equal(compareBoundary(polygon,[[1,1],[1.5,1.5]]).available,false);
});
test('concave regions and collinear nonoverlapping edges remain supported',()=>{
 const polygon:[number,number][]=[[0,0],[1,0],[2,0],[2,1],[1,1],[1,2],[0,2]];
 assert.deepEqual(compareBoundary(polygon,[[.5,.5],[1.5,1.5],[1,1.5]]),{available:true,outside:1,total:3});
});
