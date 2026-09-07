import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FlightReport } from './flight-report';

export async function reportPdf(report: FlightReport, organization: string, snapshotAt: string) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await readFile(path.join(process.cwd(),'public/fonts/DejaVuSans.ttf')), {subset:true});
  const stamp = new Date(snapshotAt);
  pdf.setCreationDate(stamp); pdf.setModificationDate(stamp);
  pdf.setTitle(`AeroLog ${report.request.type} report - ${report.entityName}`);
  pdf.setAuthor(organization); pdf.setProducer('AeroLog report renderer 1');
  const ink = rgb(.10,.18,.20), muted = rgb(.35,.43,.45), teal = rgb(.05,.40,.43);
  let page = pdf.addPage([595,842]), y = 740;
  const pages = [page];
  function header() {
    page.drawRectangle({x:0,y:782,width:595,height:60,color:ink});
    page.drawText('AEROLOG / OPERATIONS REPORT',{x:42,y:807,size:15,font,color:rgb(.81,.95,.57)});
  }
  header();
  function reserve(height:number) {
    if(y-height<55){page=pdf.addPage([595,842]);pages.push(page);header();y=752;}
  }
  function lines(text:string,size=10) {
    const output:string[]=[];
    for(const paragraph of String(text).replace(/[\r\t]/g,' ').split('\n')) {
      let line='';
      for(const char of paragraph) {
        if(font.widthOfTextAtSize(line+char,size)>511){output.push(line);line=char;} else line+=char;
      }
      output.push(line);
    }
    return output;
  }
  function text(value:string,size=10,color=ink) {
    for(const line of lines(value,size)){reserve(size+6);page.drawText(line,{x:42,y,size,font,color});y-=size+6;}
  }
  function section(title:string){reserve(58);y-=12;text(title,13,teal);y-=4;}
  text(organization,12);text(`${report.request.type}: ${report.entityName}`,18);
  text(`${report.request.from} to ${report.request.to}`,11,muted);
  text(`Snapshot: ${snapshotAt}`,9,muted);
  section('Flight totals');
  text(`${report.flightCount} flights | ${report.durationSeconds} seconds | ${(report.durationSeconds/3600).toFixed(2)} hours | ${report.distanceKm.toFixed(2)} km`,12);
  text(`Undated flights excluded: ${report.undatedExcluded}. Unattributed pilot flights: ${report.unattributedPilots}.`,9,muted);
  for(const note of report.notes)text(note,9,muted);
  section('Flight ledger');
  if(!report.rows.length)text('No flights in the selected period.');
  for(const row of report.rows){
    reserve(100);
    text(`${row[1]} | ${row[3]}`,11);
    text(`${row[4]} | ${row[6]} | ${row[8]} seconds | ${row[9]} km`,10);
    text(`Flight ${row[0]} | revision ${row[13]}`,8,muted);
    text(`Pilot ID: ${row[5] || 'Unattributed'} | Aircraft ID: ${row[7] || 'Unmapped'}`,8,muted);
    text(`Battery IDs: ${row[10] || 'Not recorded'} | Source: ${row[11]}`,8,muted);
    if(row[12])text(`Import hash: ${row[12]}`,8,muted);
    y-=8;
  }
  if(report.history){
    section('Equipment history');
    text('Completed services use completion date; open services use scheduled due date. Timestamped readings use UTC dates. Costs retain their original currencies. Cycle counters are not summed.',9,muted);
    text(`Undated history excluded: ${report.history.undatedExcluded}`,9,muted);
    if(!report.history.rows.length)text('No equipment history in the selected period.');
    for(const row of report.history.rows){reserve(95);text(`${row[0]} | ${row[4]}`,11);text(`${row[1]} | ${row[5]}`,9);text(`Actor / technician: ${row[6] || 'Not recorded'}`,9);text(`Cost: ${row[7] === '' ? 'Not recorded' : row[8]+' '+row[7]}`,9);text(`${row[2]} ${row[3]} | revision ${row[9]}`,8,muted);y-=8;}
    section('History source references');
    for(const ref of report.history.sourceReferences)text(`${ref.kind} ${ref.id} | revision ${ref.revision}`,8,muted);
  }
  pages.forEach((p,i)=>p.drawText(`AeroLog | Calculation ${report.version} | Renderer 1 | ${i+1} / ${pages.length}`,{x:42,y:28,size:8,font,color:muted}));
  return pdf.save();
}
