type Point = [number, number];
/** Counts recorded positions, not elapsed time or the path between samples. */
export function compareBoundary(boundary: Point[], track: Point[]) {
  const valid = (p: Point) => p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 85;
  if (boundary.length < 3 || !boundary.every(valid)) return { available: false as const, reason: 'A valid mission area with at least three points is required.' };
  const width = Math.max(...boundary.map(p=>p[0]))-Math.min(...boundary.map(p=>p[0]));
  if(width > 180) return {available:false as const,reason:'Antimeridian-spanning areas are not supported by this comparison.'};
  const area = boundary.reduce((sum,p,i)=>{const q=boundary[(i+1)%boundary.length];return sum+p[0]*q[1]-q[0]*p[1]},0);
  if(Math.abs(area)<1e-12) return {available:false as const,reason:'The mission boundary has no measurable area.'};
  if(track.length < 2 || !track.every(valid)) return {available:false as const,reason:'At least two valid recorded track positions are required.'};
  const inside=(p:Point)=>{
    let result=false;
    for(let i=0,j=boundary.length-1;i<boundary.length;j=i++){
      const a=boundary[j],b=boundary[i];
      const cross=(p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]);
      if(Math.abs(cross)<1e-12 && p[0]>=Math.min(a[0],b[0])-1e-12 && p[0]<=Math.max(a[0],b[0])+1e-12 && p[1]>=Math.min(a[1],b[1])-1e-12 && p[1]<=Math.max(a[1],b[1])+1e-12) return true;
      if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])result=!result;
    }
    return result;
  };
  const outside=track.filter(p=>!inside(p)).length;
  return {available:true as const,outside,total:track.length};
}
