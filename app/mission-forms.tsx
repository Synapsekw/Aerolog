'use client';
import { useState } from 'react';
import { useApp } from './app-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function MissionForms({
  mission,
  onChange,
}: {
  mission: any;
  onChange?: (patch: any) => void;
}) {
  const app = useApp(),
    [selected, setSelected] = useState('');
  const forms = mission.forms || [];
  function attach() {
    const t = app.items('form_template').find((t) => t.id === selected);
    if (!t) return;
    const revision = app.records.find(
      (r) => String(r.kind) === 'form_template' && r.id === t.id,
    )?.revision;
    onChange?.({
      forms: [...forms, { templateId: t.id, revision, answers: {} }],
      formSnapshots: [...(mission.formSnapshots || []), { ...t, revision }],
      ...(t.type === 'Risk assessment'
        ? {
            risks: [
              ...(mission.risks || []),
              ...t.hazards.map((h: any) => ({
                ...h,
                controlled: false,
                residualLikelihood: h.likelihood,
                residualSeverity: h.severity,
              })),
            ],
          }
        : {}),
    });
    setSelected('');
  }
  return (
    <section className="mission-forms">
      <h3>Mission forms</h3>
      {onChange && (
        <div className="row">
          <select
            aria-label="Form template"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select a template</option>
            {app
              .items('form_template')
              .filter(
                (t) =>
                  !t.archived && !forms.some((f: any) => f.templateId === t.id),
              )
              .map((t) => (
                <option value={t.id} key={t.id}>
                  {t.name} · {t.type}
                </option>
              ))}
          </select>
          <Button variant="outline" disabled={!selected} onClick={attach}>
            Attach template
          </Button>
        </div>
      )}
      {forms.map((form: any) => {
        const snapshot = mission.formSnapshots?.find(
          (s: any) => s.id === form.templateId && s.revision === form.revision,
        );
        if (!snapshot)
          return (
            <p key={form.templateId}>
              Template snapshot unavailable. Save or reselect this form.
            </p>
          );
        const answer = (id: string, value: any) =>
          onChange?.({
            forms: forms.map((f: any) =>
              f === form ? { ...f, answers: { ...f.answers, [id]: value } } : f,
            ),
          });
        return (
          <article className="inspection-rule" key={form.templateId}>
            <h4>
              {snapshot.name} · v{form.revision}
            </h4>
            <p>{snapshot.notes}</p>
            {snapshot.type === 'Risk assessment' && (
              <p>
                Risk starting point attached. Review its hazards and controls in
                the mission risk assessment; they are not automatically
                accepted.
              </p>
            )}
            {snapshot.fields?.map((f: any) => (
              <label className="field" key={f.id}>
                {f.label}
                {f.required ? ' *' : ''}
                {!onChange ? (
                  <span>
                    {form.answers[f.id] === undefined ||
                    form.answers[f.id] === ''
                      ? 'Not answered'
                      : typeof form.answers[f.id] === 'boolean'
                        ? form.answers[f.id]
                          ? 'Checked'
                          : 'Not checked'
                        : String(form.answers[f.id])}
                  </span>
                ) : f.type === 'Check' ? (
                  <input
                    type="checkbox"
                    checked={form.answers[f.id] === true}
                    onChange={(e) => answer(f.id, e.target.checked)}
                  />
                ) : f.type === 'Choice' ? (
                  <select
                    value={form.answers[f.id] || ''}
                    onChange={(e) => answer(f.id, e.target.value)}
                  >
                    <option value="">Select…</option>
                    {f.options.map((o: string) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type={
                      f.type === 'Number'
                        ? 'number'
                        : f.type === 'Date'
                          ? 'date'
                          : 'text'
                    }
                    step={f.type === 'Number' ? 'any' : undefined}
                    value={form.answers[f.id] ?? ''}
                    onChange={(e) =>
                      answer(
                        f.id,
                        f.type === 'Number' && e.target.value !== ''
                          ? Number(e.target.value)
                          : e.target.value,
                      )
                    }
                  />
                )}
              </label>
            ))}
            {onChange && (
              <Button
                variant="ghost"
                onClick={() =>
                  onChange({
                    forms: forms.filter((f: any) => f !== form),
                    formSnapshots: mission.formSnapshots.filter(
                      (s: any) => s.id !== form.templateId,
                    ),
                  })
                }
              >
                Remove form
              </Button>
            )}
          </article>
        );
      })}
      {!forms.length && <p>No reusable forms attached.</p>}
    </section>
  );
}
