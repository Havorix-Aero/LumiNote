import {
  noteCreateRequestSchema,
  noteListQuerySchema,
  noteUpdateRequestSchema,
  versionCreateRequestSchema,
  versionListQuerySchema,
  versionPatchRequestSchema,
} from '@luminote/core';
import { Hono } from 'hono';
import type { AppEnv } from '../http/context';
import { auth as authContext } from '../http/guards';
import { noContent, ok } from '../http/respond';
import { parseJson, parseQuery } from '../http/validate';
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  updateNoteContent,
} from '../services/note-service';
import {
  getVersion,
  listVersions,
  patchVersion,
  restoreVersion,
  saveVersion,
} from '../services/version-service';

export const noteRoutes = new Hono<AppEnv>();

noteRoutes.get('/', async (c) => {
  const query = parseQuery(c, noteListQuerySchema);
  const notes = await listNotes(c.env, authContext(c), {
    limit: query.limit,
    sinceRev: query.since,
  });
  return ok(c, { notes });
});

noteRoutes.post('/', async (c) => {
  const body = await parseJson(c, noteCreateRequestSchema);
  const note = await createNote(c.env, authContext(c), body);
  return ok(c, { note }, 201);
});

noteRoutes.get('/:id', async (c) => {
  return ok(c, { note: await getNote(c.env, authContext(c), c.req.param('id')) });
});

noteRoutes.patch('/:id', async (c) => {
  const body = await parseJson(c, noteUpdateRequestSchema);
  const note = await updateNoteContent(c.env, authContext(c), c.req.param('id'), body);
  return ok(c, { note });
});

noteRoutes.delete('/:id', async (c) => {
  await deleteNote(c.env, authContext(c), c.req.param('id'));
  return noContent(c);
});

// ---------------------------------------------------------------- version history

noteRoutes.get('/:id/versions', async (c) => {
  const query = parseQuery(c, versionListQuerySchema);
  const result = await listVersions(c.env, authContext(c), c.req.param('id'), {
    limit: query.limit,
    cursor: query.cursor,
  });
  return ok(c, result);
});

noteRoutes.post('/:id/versions', async (c) => {
  const body = await parseJson(c, versionCreateRequestSchema);
  const version = await saveVersion(c.env, authContext(c), c.req.param('id'), body);
  return ok(c, { version }, 201);
});

noteRoutes.get('/:id/versions/:versionId', async (c) => {
  const version = await getVersion(c.env, authContext(c), c.req.param('versionId'));
  return ok(c, { version });
});

noteRoutes.patch('/:id/versions/:versionId', async (c) => {
  const body = await parseJson(c, versionPatchRequestSchema);
  const version = await patchVersion(c.env, authContext(c), c.req.param('versionId'), body);
  return ok(c, { version });
});

noteRoutes.post('/:id/versions/:versionId/restore', async (c) => {
  const result = await restoreVersion(
    c.env,
    authContext(c),
    c.req.param('id'),
    c.req.param('versionId'),
  );
  return ok(c, result);
});
