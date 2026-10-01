import { describe, expect, it } from 'vitest';
import { Client, registerUser } from './support';

async function createNote(client: Client, body: string): Promise<string> {
  const created = await client.request<{ note: { id: string; rev: number } }>('/api/v1/notes', {
    method: 'POST',
    json: { body },
  });
  expect(created.status).toBe(201);
  return created.body.note.id;
}

describe('notes', () => {
  it('creates, reads, lists, updates and soft-deletes a note', async () => {
    const client = new Client();
    await registerUser(client, 'noteuser1');

    const id = await createNote(client, '第一个灵感：做一个随时能记的笔记本');

    const fetched = await client.request<{ note: { body: string; rev: number } }>(
      `/api/v1/notes/${id}`,
    );
    expect(fetched.body.note.body).toBe('第一个灵感：做一个随时能记的笔记本');
    expect(fetched.body.note.rev).toBe(1);

    const listed = await client.request<{ notes: unknown[] }>('/api/v1/notes');
    expect(listed.body.notes).toHaveLength(1);

    const updated = await client.request<{ note: { body: string; rev: number } }>(
      `/api/v1/notes/${id}`,
      { method: 'PATCH', json: { body: '改过的内容', baseRev: 1 } },
    );
    expect(updated.body.note.rev).toBe(2);

    const stale = await client.request(`/api/v1/notes/${id}`, {
      method: 'PATCH',
      json: { body: '基于旧版本的修改', baseRev: 1 },
    });
    expect(stale.status).toBe(409);

    const removed = await client.request(`/api/v1/notes/${id}`, { method: 'DELETE' });
    expect(removed.status).toBe(204);

    const afterDelete = await client.request<{ notes: unknown[] }>('/api/v1/notes');
    expect(afterDelete.body.notes).toHaveLength(0);
  });

  it('is idempotent when the same client id is reused', async () => {
    const client = new Client();
    await registerUser(client, 'noteuser2');

    const first = await client.request<{ note: { id: string } }>('/api/v1/notes', {
      method: 'POST',
      json: { id: 'offline-generated-id', body: '离线创建的灵感' },
    });
    const second = await client.request<{ note: { id: string; rev: number } }>('/api/v1/notes', {
      method: 'POST',
      json: { id: 'offline-generated-id', body: '离线创建的灵感' },
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.note.rev).toBe(1);
  });

  it('does not let one user read another user\u2019s note', async () => {
    const owner = new Client();
    await registerUser(owner, 'noteowner');
    const id = await createNote(owner, '私密内容');

    const stranger = new Client();
    await registerUser(stranger, 'notetstranger');
    expect((await stranger.request(`/api/v1/notes/${id}`)).status).toBe(404);
  });
});

describe('version history', () => {
  it('records an initial version, saves manually, and restores without losing history', async () => {
    const client = new Client();
    await registerUser(client, 'versionuser');

    const id = await createNote(client, 'v1 内容');

    const initial = await client.request<{
      items: Array<{ id: string; source: string; body: string }>;
    }>(`/api/v1/notes/${id}/versions`);
    expect(initial.body.items).toHaveLength(1);
    expect(initial.body.items[0]?.source).toBe('auto');
    expect(initial.body.items[0]?.body).toBe('v1 内容');

    const saved = await client.request<{ version: { id: string; source: string } }>(
      `/api/v1/notes/${id}/versions`,
      { method: 'POST', json: { label: '提交前' } },
    );
    expect(saved.status).toBe(201);
    expect(saved.body.version.source).toBe('manual');

    // Move the note on, then restore the original snapshot.
    await client.request(`/api/v1/notes/${id}`, {
      method: 'PATCH',
      json: { body: 'v2 内容' },
    });

    const original = initial.body.items[0]!.id;
    const restored = await client.request<{
      note: { body: string };
      version: { source: string; restoredFromId: string | null };
    }>(`/api/v1/notes/${id}/versions/${original}/restore`, { method: 'POST' });

    expect(restored.status).toBe(200);
    expect(restored.body.note.body).toBe('v1 内容');
    expect(restored.body.version.source).toBe('restore');
    expect(restored.body.version.restoredFromId).toBe(original);

    const all = await client.request<{ items: Array<{ source: string; body: string }> }>(
      `/api/v1/notes/${id}/versions`,
    );
    // v1, manual, the pre-restore auto snapshot of v2, and the restore marker itself.
    const sources = all.body.items.map((item) => item.source).sort();
    expect(sources).toEqual(['auto', 'auto', 'manual', 'restore']);
  });

  it('pins and labels a version', async () => {
    const client = new Client();
    await registerUser(client, 'pinuser');
    const id = await createNote(client, '需要保留的版本');

    const list = await client.request<{ items: Array<{ id: string }> }>(
      `/api/v1/notes/${id}/versions`,
    );
    const versionId = list.body.items[0]!.id;

    const patched = await client.request<{ version: { pinned: boolean; label: string | null } }>(
      `/api/v1/notes/${id}/versions/${versionId}`,
      { method: 'PATCH', json: { pinned: true, label: '重要' } },
    );
    expect(patched.body.version.pinned).toBe(true);
    expect(patched.body.version.label).toBe('重要');
  });
});

describe('sync', () => {
  it('pushes local mutations and pulls them back on another device', async () => {
    const deviceA = new Client();
    await registerUser(deviceA, 'syncuser');

    const pushed = await deviceA.request<{ results: Array<{ status: string }>; cursor: number }>(
      '/api/v1/sync/push',
      {
        method: 'POST',
        json: {
          mutations: [
            {
              mutationId: 'm1',
              entity: 'note',
              entityId: 'sync-note-1',
              op: 'upsert',
              note: {
                title: null,
                body: '离线时写下的想法',
                pinned: false,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            },
          ],
        },
      },
    );
    expect(pushed.body.results[0]?.status).toBe('applied');

    const pulled = await deviceA.request<{
      changes: unknown[];
      notes: Array<{ id: string; body: string }>;
      cursor: number;
      hasMore: boolean;
    }>('/api/v1/sync/pull', { method: 'POST', json: { cursor: 0 } });

    const note = pulled.body.notes.find((item) => item.id === 'sync-note-1');
    expect(note?.body).toBe('离线时写下的想法');
    expect(pulled.body.cursor).toBeGreaterThan(0);
    expect(pulled.body.hasMore).toBe(false);
  });

  it('keeps the server copy on conflict and preserves the losing text as a version', async () => {
    const client = new Client();
    await registerUser(client, 'conflictuser');

    const base = {
      mutationId: 'a',
      entity: 'note' as const,
      entityId: 'conflict-note',
      op: 'upsert' as const,
      note: {
        title: null,
        body: '服务器较新的内容',
        pinned: false,
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-02T00:00:00.000Z',
      },
    };
    await client.request('/api/v1/sync/push', { method: 'POST', json: { mutations: [base] } });

    const conflicted = await client.request<{
      results: Array<{
        status: string;
        conflictVersionId?: string;
        note?: { body: string };
      }>;
    }>('/api/v1/sync/push', {
      method: 'POST',
      json: {
        mutations: [
          {
            ...base,
            mutationId: 'b',
            note: {
              ...base.note,
              body: '另一台设备上较旧的修改',
              updatedAt: '2026-02-01T12:00:00.000Z',
            },
          },
        ],
      },
    });

    const result = conflicted.body.results[0];
    expect(result?.status).toBe('conflict');
    expect(result?.note?.body).toBe('服务器较新的内容');
    expect(result?.conflictVersionId).toBeTruthy();

    const versions = await client.request<{ items: Array<{ id: string; label: string | null }> }>(
      '/api/v1/notes/conflict-note/versions',
    );
    const preserved = versions.body.items.find((item) => item.id === result?.conflictVersionId);
    expect(preserved?.label).toBe('冲突副本');
  });

  it('acknowledges a replayed mutation without changing the revision', async () => {
    const client = new Client();
    await registerUser(client, 'replayuser');

    const mutation = {
      mutationId: 'r1',
      entity: 'note' as const,
      entityId: 'replay-note',
      op: 'upsert' as const,
      note: {
        title: null,
        body: '内容',
        pinned: false,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    };

    const first = await client.request<{ results: Array<{ rev?: number }> }>('/api/v1/sync/push', {
      method: 'POST',
      json: { mutations: [mutation] },
    });
    const second = await client.request<{ results: Array<{ status: string; rev?: number }> }>(
      '/api/v1/sync/push',
      { method: 'POST', json: { mutations: [{ ...mutation, mutationId: 'r2' }] } },
    );

    expect(first.body.results[0]?.rev).toBe(1);
    expect(second.body.results[0]?.status).toBe('applied');
    expect(second.body.results[0]?.rev).toBe(1);
  });
});

describe('providers', () => {
  it('reports the configured providers', async () => {
    const client = new Client();
    await registerUser(client, 'provideruser');
    const status = await client.request<{
      llm: { provider: string };
      stt: { provider: string };
      segmenter: { provider: string };
    }>('/api/v1/providers/status');

    expect(status.status).toBe(200);
    expect(status.body.llm.provider).toBe('mock');
  });

  it('streams a chat completion from the mock provider', async () => {
    const client = new Client();
    await registerUser(client, 'chatuser');

    const response = await client.request(
      '/api/v1/ai/chat',
      {
        method: 'POST',
        json: { messages: [{ role: 'user', content: '帮我评估这个想法' }] },
      },
      { raw: true },
    );

    expect(response.status).toBe(200);
    const text = await response.response.text();
    expect(text).toContain('data:');
    expect(text).toContain('done');
  });

  it('rejects transcribe requests without an audio file', async () => {
    const client = new Client();
    await registerUser(client, 'sttuser');
    const response = await client.request('/api/v1/stt/transcribe', { method: 'POST' });
    expect([400, 422]).toContain(response.status);
  });
});
