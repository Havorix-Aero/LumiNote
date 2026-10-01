import { z } from 'zod';
import {
  NOTE_BODY_MAX_LENGTH,
  NOTE_TITLE_MAX_LENGTH,
  SYNC_PAGE_SIZE,
  VERSION_LABEL_MAX_LENGTH,
} from '../constants';

const isoDateTime = z.string().datetime({ offset: true });

export const noteIdSchema = z.string().min(1).max(80);

export const noteCreateRequestSchema = z
  .object({
    /** Client-generated id so offline notes keep a stable identity before first sync. */
    id: z.string().min(1).max(80).optional(),
    title: z.string().max(NOTE_TITLE_MAX_LENGTH).nullable().optional(),
    body: z.string().max(NOTE_BODY_MAX_LENGTH),
    clientCreatedAt: isoDateTime.optional(),
  })
  .strict();

export const noteUpdateRequestSchema = z
  .object({
    title: z.string().max(NOTE_TITLE_MAX_LENGTH).nullable().optional(),
    body: z.string().max(NOTE_BODY_MAX_LENGTH).optional(),
    pinned: z.boolean().optional(),
    /** Optimistic concurrency: the revision the client last saw. */
    baseRev: z.number().int().nonnegative().optional(),
  })
  .strict();

export const noteListQuerySchema = z
  .object({
    since: z.coerce.number().int().nonnegative().optional(),
    limit: z.coerce.number().int().min(1).max(SYNC_PAGE_SIZE).optional(),
    includeDeleted: z
      .union([z.literal('true'), z.literal('false'), z.boolean()])
      .transform((v) => v === true || v === 'true')
      .optional(),
  })
  .strict();

export const versionCreateRequestSchema = z
  .object({
    label: z.string().max(VERSION_LABEL_MAX_LENGTH).optional(),
    /** Optional overrides so an explicit save can include edits not yet flushed to the note. */
    title: z.string().max(NOTE_TITLE_MAX_LENGTH).nullable().optional(),
    body: z.string().max(NOTE_BODY_MAX_LENGTH).optional(),
  })
  .strict();

export const versionPatchRequestSchema = z
  .object({
    pinned: z.boolean().optional(),
    label: z.string().max(VERSION_LABEL_MAX_LENGTH).nullable().optional(),
  })
  .strict();

export const versionListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(SYNC_PAGE_SIZE).optional(),
    cursor: z.string().max(512).optional(),
  })
  .strict();

export type NoteCreateRequest = z.infer<typeof noteCreateRequestSchema>;
export type NoteUpdateRequest = z.infer<typeof noteUpdateRequestSchema>;
export type NoteListQuery = z.infer<typeof noteListQuerySchema>;
export type VersionCreateRequest = z.infer<typeof versionCreateRequestSchema>;
export type VersionPatchRequest = z.infer<typeof versionPatchRequestSchema>;
export type VersionListQuery = z.infer<typeof versionListQuerySchema>;
