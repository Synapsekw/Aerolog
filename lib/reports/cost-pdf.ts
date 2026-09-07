import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { organizationCosts } from './organization-costs';

export async function costPdf(report: ReturnType<typeof organizationCosts>, organization: string, snapshotAt: string) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await readFile(path.join(process.cwd(), 'public/fonts/DejaVuSans.ttf')), {subset:true});
  pdf.setCreationDate(new Date(snapshotAt)); pdf.setModificationDate(new Date(snapshotAt));
  pdf.setTitle('AeroLog organization maintenance costs'); pdf.setAuthor(organization); pdf.setProducer('AeroLog cost renderer 1');
  const ink = rgb(.10,.18,.20), muted = rgb(.35,.43,.45), teal = rgb(.05,.40,.43);
  const pages = [pdf.addPage([595,842])];
  let page = pages[0], y = 750;
  function header() {
    page.drawRectangle({x:0,y:782,width:595,height:60,color:ink});
    page.drawText('AEROLOG / MAINTENANCE COSTS',{x:42,y:807,size:15,font,color:rgb(.81,.95,.57)});
  }
  header();
  function reserve(height: number) { if(y-height<55){page=pdf.addPage([595,842]);pages.push(page);header();y=750;} }
  function text(value: string, size=10, color=ink) {
    const lines: string[] = [];
    for (const paragraph of String(value).replace(/[\r\t]/g,' ').split('\n')) {
      let line='';
      for (const char of paragraph) {
        if(font.widthOfTextAtSize(line+char,size)>511){
          const space=line.lastIndexOf(' ');
          if(space>0){lines.push(line.slice(0,space));line=line.slice(space+1)+char;}
          else {lines.push(line);line=char;}
        }else line+=char;
      }
      lines.push(line);
    }
    for(const line of lines){reserve(size+6);page.drawText(line,{x:42,y,size,font,color});y-=size+6;}
  }
  function section(title: string){reserve(60);y-=10;text(title,13,teal);y-=4;}
  text(organization,16); text(`${report.from} to ${report.to}`,12); text(`Snapshot: ${snapshotAt}`,9,muted);
  text('Recorded work-order amounts. No currency conversion. These totals do not establish payment or recognized accounting expenses.',9,muted);
  section('Currency totals');
  for(const t of report.totals){text(`${t.currency} | Completed: ${t.completed} (${t.completedCount} work orders)`,11);text(`Open: ${t.open} (${t.openCount} work orders)`,10);}
  if(!report.totals.length)text('No work orders with a valid recorded cost and currency.');
  text(`${report.serviceCount} work orders | ${report.missingCost} missing costs | ${report.invalidCost} invalid amounts | ${report.missingCurrency} missing/invalid currencies`,9,muted);
  text(`${report.undatedExcluded} undated work orders excluded. Missing amounts are excluded from totals; recorded zero costs are included.`,9,muted);
  section('Work-order ledger');
  text('Completed work uses completion date (UTC); other work uses scheduled due date. Source identities and revisions are retained below.',9,muted);
  if(!report.rows.length)text('No work orders in the selected period.');
  for(const r of report.rows){
    reserve(120);
    text(`${r[0]} | ${r[4]}`,11);
    text(`${r[5]} | ${r[1]}`,9,muted);
    text(`Equipment: ${r[12] || 'Not recorded'} | ${r[10]} ${r[11] || 'No stable equipment ID'}`,9);
    text(`Cost: ${r[7] === '' ? 'Not recorded' : `${r[8] || 'Currency missing'} ${r[7]}`}`,10);
    text(`Technician: ${r[6] || 'Not recorded'} | Cost reference: ${r[13] || 'Not recorded'}`,9);
    text(`Source: service ${r[3]} | revision ${r[9]}`,8,muted);y-=10;
  }
  pages.forEach((p,i)=>p.drawText(`AeroLog | Cost calculation ${report.version} | Renderer 1 | ${i+1} / ${pages.length}`,{x:42,y:28,size:8,font,color:muted}));
  return pdf.save();
}
