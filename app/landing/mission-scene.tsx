'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import PhantomDrone from './phantom-drone';

type Point = [number, number, number];
type Props = { mission: number; progress: number; zoom: number; top: boolean; obstacles: boolean; reduced: boolean; flying: boolean; label: string; onZoom: (value:number)=>void };
// Illustrative local coordinates in metres; this rehearsal is not navigation data.
const footprints = [
 [-240,-165,35,35,30],[-186,-165,32,47,45],[-128,-165,42,40,24],[-65,-165,28,36,58],[4,-165,46,38,32],[78,-165,30,45,48],[139,-165,42,35,20],[202,-165,32,38,38],
 [-240,-90,38,40,44],[-175,-90,30,37,65],[-100,-82,48,34,22],[-25,-80,39,44,38],[52,-86,42,48,27],[130,-90,42,40,56],[205,-90,36,40,32],
 [-240,-10,38,36,35],[-174,-10,32,36,28],[-94,-4,38,42,54],[-17,-3,45,42,63],[59,-8,38,44,36],[136,-6,33,40,42],[201,-8,44,33,22],
 [-235,75,34,40,24],[-168,75,37,44,44],[-90,79,42,35,30],[-17,78,38,43,25],[59,74,37,46,46],[135,78,38,41,20],[209,80,28,38,26],
 [-230,150,37,27,24],[-160,147,41,32,16],[-86,154,35,24,25],[-14,149,40,29,18],[63,151,39,26,22],[135,152,45,27,18],[207,149,36,30,15],
];
function route(mission:number):Point[]{
 const path:Point[]=[];
 if(mission%3===0){
  for(let i=0;i<=120;i++){const t=i/120*Math.PI*2;const x=145*Math.sign(Math.cos(t))*Math.pow(Math.abs(Math.cos(t)),.45);const y=108*Math.sign(Math.sin(t))*Math.pow(Math.abs(Math.sin(t)),.45);path.push([x,y,66+24*Math.sin(i/120*Math.PI)]);}
 }else if(mission%3===1){
  for(let r=0;r<7;r++){const y=-140+r*43;for(let c=0;c<=15;c++)path.push([r%2===0?-180+c*24:180-c*24,y,66+24*Math.sin((r*16+c)/111*Math.PI)]);}
 }else{
  for(let i=0;i<=120;i++){const t=i/120;path.push([-245+t*490,Math.sin(t*Math.PI*3)*75,66+24*Math.sin(t*Math.PI)]);}
 }
 return path;
}
export default function MissionScene({mission,progress,zoom,top,obstacles,reduced,flying,label,onZoom}:Props){
 const [angle,setAngle]=useState(-.48);
 const [camera,setCamera]=useState({zoom:1,tilt:.58});
 const cameraRef=useRef(camera);
 const drag=useRef<{x:number;angle:number}|null>(null);
 const [dragging,setDragging]=useState(false);
 const svgRef=useRef<SVGSVGElement>(null);
 const points=useMemo(()=>route(mission),[mission]);
 useEffect(()=>{
  const target={zoom,tilt:top?1:.58};
  if(reduced){cameraRef.current=target;setCamera(target);return;}
  let raf=0;
  const move=()=>{const c=cameraRef.current;const next={zoom:c.zoom+(target.zoom-c.zoom)*.16,tilt:c.tilt+(target.tilt-c.tilt)*.16};cameraRef.current=next;setCamera(next);if(Math.abs(next.zoom-target.zoom)+Math.abs(next.tilt-target.tilt)>.002)raf=requestAnimationFrame(move);};
  raf=requestAnimationFrame(move);return()=>cancelAnimationFrame(raf);
 },[zoom,top,reduced]);
 const project=([x,y,z]:Point):[number,number]=>{const sx=450+(x*Math.cos(angle)-y*Math.sin(angle))*1.25*camera.zoom;const sy=290+(x*Math.sin(angle)+y*Math.cos(angle))*camera.tilt*1.25*camera.zoom-z*(1-camera.tilt)*3*camera.zoom;return [Math.round(sx*100)/100,Math.round(sy*100)/100];};
 const polygon=(points:Point[])=>points.map(p=>project(p).join(',')).join(' ');
 const line=(a:Point,b:Point)=>`M${project(a).join(',')}L${project(b).join(',')}`;
 const svgPath=(ps:Point[])=>ps.map((p,i)=>(i?'L':'M')+project(p).join(',')).join('');
 const sample=(progress/100)*(points.length-1),index=Math.floor(sample),mix=sample-index;
 const pos=points[index].map((p,i)=>p+((points[Math.min(index+1,points.length-1)][i])-p)*mix) as Point;
 const nextPoint=points[Math.min(index+1,points.length-1)];
 const previousPoint=points[Math.max(0,index-1)];
 const heading=Math.atan2(nextPoint[0]-previousPoint[0],nextPoint[1]-previousPoint[1])+Math.PI;
 const [px,py]=project(pos);
 const [groundX,groundY]=project([pos[0],pos[1],0]);
 const solar=Array.from({length:54},(_,i)=>[-250+(i%9)*58,-155+Math.floor(i/9)*57,43,31,6]);
 const shore=(x:number)=>Math.sin(x/85)*38-28;
 const terrain=(x:number,y:number):Point=>[x,y,Math.max(0,y-shore(x))*.2+Math.max(0,Math.sin(x/76))*Math.max(0,y-shore(x))*.15];
 const coastCells=Array.from({length:26},(_,i)=>-312+i*24).flatMap(x=>Array.from({length:17},(_,j)=>-180+j*24).map(y=>({x,y,land:y>shore(x)})));
 const sorted=(mission===1?solar:footprints).map((box,i)=>({box,i,depth:project([box[0],box[1],0])[1]})).sort((a,b)=>a.depth-b.depth);
 return <svg ref={svgRef} className={`ax-spatial-svg ${dragging?'ax-dragging':''}`} viewBox="0 0 900 490" role="img" tabIndex={0} aria-label={`Three-dimensional mission schematic with a DJI Phantom 4 aircraft for ${label}. Drag or use left and right arrow keys to orbit. Use plus and minus to zoom.`}
 onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setAngle(a=>a+(e.key==='ArrowLeft'?-.1:.1));}if(e.key==='+'||e.key==='='){e.preventDefault();onZoom(Math.min(1.5,zoom+.15));}if(e.key==='-'){e.preventDefault();onZoom(Math.max(.7,zoom-.15));}}}
 onPointerDown={e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,angle};setDragging(true);}}
 onPointerMove={e=>{if(drag.current)setAngle(drag.current.angle+(e.clientX-drag.current.x)*.005);}}
 onPointerUp={()=>{drag.current=null;setDragging(false);}} onPointerCancel={()=>{drag.current=null;setDragging(false);}}>
 <defs><radialGradient id="ax-ground"><stop stopColor="#343b46" stopOpacity=".45"/><stop offset="1" stopColor="#151b23" stopOpacity="0"/></radialGradient><linearGradient id="ax-envelope" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#c6fb76" stopOpacity=".04"/><stop offset="1" stopColor="#c6fb76" stopOpacity=".18"/></linearGradient><filter id="ax-glow"><feGaussianBlur stdDeviation="3"/></filter><linearGradient id="ax-roof" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#4c535b"/><stop offset="1" stopColor="#303741"/></linearGradient></defs>
 <ellipse cx="450" cy="275" rx="390" ry="200" fill="url(#ax-ground)"/>
 <g stroke="#7a8796" strokeWidth=".55" opacity=".28">{Array.from({length:31},(_,i)=>i*25-375).map(n=><g key={n}><path d={line([n,-240,0],[n,240,0])}/><path d={line([-375,n*.65,0],[375,n*.65,0])}/></g>)}</g>
 <g fill="#8f9daf" opacity=".25">{Array.from({length:15},(_,i)=>i*50-350).flatMap(x=>Array.from({length:9},(_,j)=>j*50-200).map(y=>{const [px,py]=project([x,y,0]);return <circle key={`${x},${y}`} cx={px} cy={py} r="1.3"/>;}))}</g>
 <g stroke="#6f7e8f" opacity=".3" strokeWidth="1"><path d={line([-320,-125,0],[320,-125,0])}/><path d={line([-320,42,0],[320,42,0])}/><path d={line([-320,130,0],[320,130,0])}/><path d={line([-130,-220,0],[-130,230,0])}/><path d={line([114,-220,0],[114,230,0])}/></g>
 <polygon points={polygon([[-165,-130,0],[178,-130,0],[178,141,0],[-165,141,0]])} fill="#bac6d410" stroke="#a2afbd55" strokeWidth="1" strokeDasharray="4 5"/>
 {mission===2&&<g className="al-coastal-terrain">{coastCells.map(({x,y,land},i)=><polygon key={i} points={polygon(land?[terrain(x,y),terrain(x+24,y),terrain(x+24,y+24),terrain(x,y+24)]:[[x,y,0],[x+24,y,0],[x+24,y+24,0],[x,y+24,0]])} fill={land?"#45526577":"#1c2b4055"} stroke={land?"#8fa4bd70":"#7195b638"} strokeWidth=".7"/>)}<path d={svgPath(Array.from({length:101},(_,i)=>{const x=-312+i*6.24;return [x,shore(x),0] as Point;}))} fill="none" stroke="#b4cddd" strokeWidth="1.5"/></g>}
 {obstacles&&mission!==2&&<g className="ax-obstacles">{sorted.map(({box:[x,y,w,d,height],i})=>{const h=mission%3===1?Math.min(height,8):height; const corners:Point[]=[[x,y,0],[x+w,y,0],[x+w,y+d,0],[x,y+d,0]];const roof=corners.map(([a,b])=>[a,b,h] as Point);return <g key={i}><polygon points={polygon(corners)} fill="#080c1188" stroke="#6d7b8c55" strokeWidth=".7"/>{[0,1,2,3].map(side=><polygon key={side} points={polygon([corners[side],corners[(side+1)%4],roof[(side+1)%4],roof[side]])} fill={side%2?'#202731':'#29323d'} stroke="#8190a166" strokeWidth=".6"/>)}<polygon points={polygon(roof)} fill={mission===1?(i===22||i===31?"#bc9d4877":"#313c49"):"url(#ax-roof)"} stroke={mission===1?"#9babba77":"#9eabba66"} strokeWidth=".8"/>{mission===1&&[1,2,3].map(n=><path key={n} d={line([x+w*n/4,y,h],[x+w*n/4,y+d,h])} stroke="#9eaec344" strokeWidth=".65"/>)}{h>40&&<path d={line([x,y,h*.5],[x+w,y,h*.5])} stroke="#9bacc033" strokeWidth=".7"/>}</g>;})}</g>}
 <g fill="none"><path d={svgPath(points.map(([x,y])=>[x,y,0]))} stroke="var(--al-mission)" strokeOpacity=".25" strokeWidth="1" strokeDasharray="3 5"/>{points.filter((_,i)=>i%24===0).map((p,i)=><path key={i} d={line([p[0],p[1],0],p)} stroke="var(--al-mission)" strokeOpacity=".3" strokeWidth=".8" strokeDasharray="2 4"/>)}<path d={svgPath(points)} stroke="var(--al-mission)" strokeWidth="7" opacity=".2" filter="url(#ax-glow)"/><path d={svgPath(points)} stroke="var(--al-mission)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity=".8"/><path d={svgPath([...points.slice(0,index+1),pos])} stroke="var(--al-mission)" strokeWidth="3" strokeLinecap="round"/></g>
 {points.filter((_,i)=>i%24===0).map((p,i)=>{const [x,y]=project(p);return <g key={i}><circle cx={x} cy={y} r="4.1" fill="#202833" stroke="var(--al-mission)" strokeWidth="1.3"/><text x={x-7} y={y-12} fill="#adbac8" fontSize="12" fontFamily="monospace">0{i+1}</text></g>;})}
 <g><line x1={px} y1={py} x2={groundX} y2={groundY} stroke="var(--al-mission)" strokeWidth="1" strokeDasharray="3 4" opacity=".7"/><ellipse cx={groundX} cy={groundY} rx="13" ry={13*camera.tilt} stroke="var(--al-mission)" fill="var(--al-mission)" fillOpacity=".10" opacity=".7"/><foreignObject x={px-80} y={py-66} width="160" height="130" style={{overflow:'visible',pointerEvents:'none'}}><PhantomDrone angle={angle} heading={heading} tilt={camera.tilt} flying={flying} reduced={reduced}/></foreignObject></g>
 <g transform={`translate(${Math.min(710,Math.max(40,px+74))},${Math.max(65,py-48)})`} className="ax-svg-label"><path d="M-28 40L-8 22H0" fill="none" stroke="var(--al-mission)"/><rect x="0" y="0" width="125" height="40" rx="4" fill="#141b24f2" stroke="#a1afc166"/><text x="12" y="16" fill="var(--al-mission)" fontSize="12" fontFamily="monospace">{label}</text><text x="12" y="31" fill="#b0bbc8" fontSize="12" fontFamily="monospace">{Math.round(pos[2])} M · REHEARSAL</text></g>
 <g fill="#8f9dad" fontSize="12" fontFamily="monospace" letterSpacing="2"><text x="63" y="403" transform="rotate(-18 63 403)">{mission===2?"COASTAL TERRAIN":mission===1?"THERMAL SURVEY GRID":"LOCAL AIRSPACE MODEL"}</text><text x="627" y="430">100 M</text><path d="M680 427h50m-50-4v8m50-8v8" stroke="#8f9dad" strokeWidth="1"/></g>
 </svg>;
}
