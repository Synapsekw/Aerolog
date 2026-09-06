import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { access } from 'node:fs/promises';
import {
  requireUser,
  requireRole,
  ApiError,
  failure,
} from '@/lib/server/supabase';
import { normalizeImport, parseTextImport } from '@/lib/domain/imports';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const { profile } = await requireUser(request);
    requireRole(profile, ['admin', 'manager', 'pilot']);
    const form = await request.formData(),
      file = form.get('file');
    if (!(file instanceof File) || !file.size || file.size > 25 * 1024 * 1024)
      throw new ApiError('Select a log file up to 25 MB.');
    const bytes = Buffer.from(await file.arrayBuffer()),
      extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'csv' || extension === 'json') {
      try {
        return Response.json(
          parseTextImport(bytes.toString('utf8'), extension),
        );
      } catch (e) {
        throw new ApiError(
          e instanceof Error ? e.message : 'Invalid import file',
        );
      }
    }
    if (extension !== 'txt')
      throw new ApiError(
        'Choose a DJI .txt flight record, CSV, or normalized JSON.',
      );
    const python = process.env.DJI_PARSER_PYTHON;
    if (!python)
      throw new ApiError(
        'Set DJI_PARSER_PYTHON to the local parser environment.',
        503,
      );
    try {
      await access(python);
    } catch {
      throw new ApiError(
        'DJI parser is not installed. Follow the local setup guide.',
        503,
      );
    }
    const parsed = await new Promise<any>((resolve, reject) => {
      const child = spawn(
        python,
        [path.join(process.cwd(), 'scripts/parse-dji.py')],
        {
          env: {
            NODE_ENV: process.env.NODE_ENV,
            PATH: process.env.PATH,
            PYTHONUNBUFFERED: '1',
            DJI_APP_KEY: process.env.DJI_APP_KEY || '',
          },
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      let output = '',
        size = 0;
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(
          new ApiError('DJI parsing timed out. Retry or import CSV.', 504),
        );
      }, 60000);
      child.stdout.on('data', (chunk) => {
        size += chunk.length;
        if (size > 20 * 1024 * 1024) {
          child.kill('SIGKILL');
          reject(new ApiError('Decoded flight exceeds the import limit.'));
        } else output += chunk;
      });
      child.stderr.resume();
      child.stdin.on('error', () => {});
      child.on('error', () => {
        clearTimeout(timer);
        reject(new ApiError('DJI parser could not start.', 503));
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        try {
          const result = JSON.parse(output);
          if (code !== 0 || result.error)
            reject(new ApiError(result.error || 'Unable to parse DJI record'));
          else resolve(result);
        } catch {
          reject(new ApiError('Invalid or unsupported DJI flight record.'));
        }
      });
      child.stdin.end(bytes);
    });
    return Response.json({
      flights: [
        normalizeImport(
          parsed,
          'DJI flight record',
          createHash('sha256').update(bytes).digest('hex'),
        ),
      ],
      warnings: [
        ...(parsed.importProvenance?.sampleSelection === 'uniform'
          ? [
              'Large DJI log: stored telemetry is uniformly sampled. The original TXT is retained in the source archive; brief voltage or temperature events may not appear in the charts.',
            ]
          : []),
        'Review equipment and battery assignments. DJI parsing does not provide historical DJI account cloud sync.',
      ],
    });
  } catch (e) {
    return failure(e);
  }
}
