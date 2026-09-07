import test from 'node:test';
import assert from 'node:assert/strict';
import {
  qualificationSchema,
  qualificationState,
} from '../lib/operations/qualifications';
test('qualification state distinguishes expired, future and missing evidence', () => {
  const q = { issued: '2026-01-01', expires: '2026-12-31', evidenceId: 'file' };
  assert.equal(qualificationState(q, '2026-09-07'), 'Current');
  assert.equal(qualificationState(q, '2027-01-01'), 'Expired');
  assert.equal(qualificationState(q, '2025-12-31'), 'Not yet valid');
  assert.equal(
    qualificationState({ ...q, evidenceId: '' }, '2026-09-07'),
    'Evidence missing',
  );
  assert.equal(qualificationState(q, '2026-12-31'), 'Current');
});
test('qualification cannot expire before issue', () => {
  assert.equal(
    qualificationSchema.safeParse({
      id: 'q',
      name: 'Endorsement',
      issued: '2026-09-07',
      expires: '2026-01-01',
      requiredForOperations: true,
    }).success,
    false,
  );
});
