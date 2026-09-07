import test from 'node:test';
import assert from 'node:assert/strict';
import { formTemplateSchema } from '../lib/operations/forms';
const base = {
  id: 'form',
  name: 'Checks',
  type: 'Checklist',
  fields: [
    {
      id: 'f',
      label: 'Inspect props',
      type: 'Check',
      required: true,
      options: [],
    },
  ],
  hazards: [],
};
test('templates reject ambiguous field IDs and empty choice options', () => {
  assert.equal(formTemplateSchema.safeParse(base).success, true);
  assert.equal(
    formTemplateSchema.safeParse({
      ...base,
      fields: [base.fields[0], base.fields[0]],
    }).success,
    false,
  );
  assert.equal(
    formTemplateSchema.safeParse({
      ...base,
      type: 'Custom form',
      fields: [{ ...base.fields[0], type: 'Choice' }],
    }).success,
    false,
  );
  assert.equal(
    formTemplateSchema.safeParse({
      ...base,
      type: 'Custom form',
      fields: [{ ...base.fields[0], type: 'Choice', options: ['A', 'A'] }],
    }).success,
    false,
  );
});
test('checklists require check fields and risk templates require bounded hazards', () => {
  assert.equal(
    formTemplateSchema.safeParse({
      ...base,
      fields: [{ ...base.fields[0], type: 'Text' }],
    }).success,
    false,
  );
  assert.equal(
    formTemplateSchema.safeParse({ ...base, type: 'Risk assessment' }).success,
    false,
  );
  assert.equal(
    formTemplateSchema.safeParse({
      ...base,
      type: 'Risk assessment',
      hazards: [
        {
          hazard: 'Wind',
          mitigation: 'Wind limit',
          likelihood: 6,
          severity: 1,
        },
      ],
    }).success,
    false,
  );
});
