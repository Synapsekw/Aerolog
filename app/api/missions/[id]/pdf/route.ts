import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { requireUser, failure, ApiError } from '@/lib/server/supabase';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { client, profile } = await requireUser(request);
    const { id } = await params;
    const { data } = await client
      .from('aerolog_records')
      .select('*')
      .eq('kind', 'mission')
      .eq('id', id)
      .single();
    if (!data) throw new ApiError('Mission not found', 404);
    const m = data.data;
    const { data: org } = await client
      .from('aerolog_organizations')
      .select('name,settings')
      .eq('id', profile.organization_id)
      .single();
    const { data: attachments } = await client
      .from('aerolog_records')
      .select('data')
      .eq('kind', 'attachment')
      .eq('data->>mission', id);
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica),
      bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([595, 842]),
      y = 790;
    const clean = (v: any) =>
      String(v ?? '')
        .replace(/[–—]/g, '-')
        .replace(/→/g, ' -> ')
        .replace(/[^\x20-\x7e\n]/g, '?');
    function line(text: string, size = 11, weight = false) {
      for (const paragraph of clean(text).split('\n')) {
        const words = paragraph.split(' ');
        let row = '';
        const rows: string[] = [];
        for (const word of words) {
          if (
            font.widthOfTextAtSize((row ? row + ' ' : '') + word, size) > 485
          ) {
            if (row) rows.push(row);
            row = word;
          } else row += (row ? ' ' : '') + word;
        }
        rows.push(row);
        for (const r of rows) {
          if (y < 60) {
            page = pdf.addPage([595, 842]);
            y = 790;
          }
          page.drawText(r, {
            x: 50,
            y,
            size,
            font: weight ? bold : font,
            color: rgb(0.12, 0.2, 0.22),
          });
          y -= size + 6;
        }
      }
    }
    function section(title: string) {
      y -= 14;
      line(title.toUpperCase(), 12, true);
      y -= 6;
    }
    line('AEROLOG / MISSION PACKAGE', 20, true);
    line(org?.name || 'Operations', 11);
    line(m.id + ' | Revision ' + data.revision + ' | ' + m.status, 11);
    section(m.name);
    line('Location: ' + m.location);
    line(
      'Date / start: ' +
        m.date +
        ' ' +
        m.time +
        ' (' +
        (org?.settings?.timezone || 'UTC') +
        ')',
    );
    line(
      'Duration: ' +
        m.durationMinutes +
        ' minutes | Altitude: ' +
        m.altitude +
        ' m AGL',
    );
    line('Operation: ' + m.type);
    section('Crew and equipment');
    line('Pilot in command: ' + m.pilot);
    line('Visual observer: ' + m.observer);
    line(
      'Aircraft: ' + [m.aircraft, ...(m.additionalAircraft || [])].join(', '),
    );
    for (const a of m.crewAssignments || []) line(a.role + ': ' + a.name);
    for (const k of m.kitSnapshots || []) {
      line('Kit: ' + k.name + ' (version ' + k.revision + ')');
      for (const i of k.items) line('  ' + i.name + ' / ' + i.serial);
    }
    line('Equipment: ' + (m.equipment.join(', ') || 'None'));
    section('Operating notes');
    line(m.notes || 'No notes provided.');
    section('Mission boundary');
    line(
      m.geometry?.length
        ? m.geometry
            .map(
              (p: number[], i: number) =>
                i + 1 + '. ' + p[1].toFixed(6) + ', ' + p[0].toFixed(6),
            )
            .join('\n')
        : 'No boundary coordinates recorded.',
    );
    section('Risk assessment');
    m.risks.forEach((r: any, i: number) => {
      line(i + 1 + '. ' + r.hazard, 11, true);
      line(
        'Initial score: ' +
          r.likelihood * r.severity +
          '/25 | Residual: ' +
          (r.residualLikelihood || r.likelihood) *
            (r.residualSeverity || r.severity) +
          '/25',
      );
      line('Mitigation: ' + r.mitigation);
      line('Control reviewed: ' + (r.controlled ? 'Yes' : 'No'));
      y -= 8;
    });
    section('Attachments');
    line(
      attachments?.length
        ? attachments.map((a) => a.data.name).join('\n')
        : 'None',
    );
    section('Review and revision history');
    m.history.forEach((h: string) => line(h));
    if (m.reviewNote) line('Review note: ' + m.reviewNote);
    if (m.debrief) {
      section('Post-flight debrief');
      line(m.debrief);
    }
    for (const [i, p] of pdf.getPages().entries())
      p.drawText(
        'AEROLOG | ' +
          clean(m.id) +
          ' | Page ' +
          (i + 1) +
          ' of ' +
          pdf.getPageCount(),
        { x: 50, y: 30, size: 9, font, color: rgb(0.4, 0.5, 0.5) },
      );
    return new Response(Buffer.from(await pdf.save()), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="mission-package.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
