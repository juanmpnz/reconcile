import { describe, expect, it } from 'vitest';
import { followUpSummary, latestDraft } from './presentation';
const draft = {
  id: 'one',
  version: 1,
  sourceVersion: 1,
  recipientEmail: null,
  subject: 'Old',
  body: 'Old body',
  reason: 'Initial',
  actorId: 'actor',
  createdAt: '2026-10-15T00:00:00.000Z',
};
describe('claim version and local follow-up presentation', () => {
  it('uses the greatest saved draft version regardless of API array order', () => {
    expect(
      latestDraft({
        drafts: [
          { ...draft, version: 3, body: 'Current' },
          draft,
          { ...draft, version: 2 },
        ],
      })?.body,
    ).toBe('Current');
  });
  it('distinguishes overdue dates from today and ignores closed claims without inventing totals', () => {
    expect(
      followUpSummary(
        [
          { status: 'sent', dueDate: '2026-10-14' },
          { status: 'follow_up', dueDate: '2026-10-15' },
          { status: 'resolved', dueDate: '2026-10-01' },
          { status: 'draft', dueDate: null },
        ],
        '2026-10-15',
      ),
    ).toEqual({ overdue: 1, next: '2026-10-15' });
  });
});
