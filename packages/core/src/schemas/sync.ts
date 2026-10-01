import { z } from 'zod';
import {
  NOTE_BODY_MAX_LENGTH,
  NOTE_TITLE_MAX_LENGTH,
  SYNC_PAGE_SIZE,
  VERSION_LABEL_MAX_LENGTH,
} from '../constants';

const isoDateTime = z.string().datetime({ offset: true });

export const syncPullRequestSchema = z
  .object({
    cursor: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(SYNC_PAGE_SIZE).optional(),
  })
  .strict();

export const syncMutationSchema = z
  .object({
    mutationId: z.string().min(1).max(80),
    entity: z.enum(['note', 'version']),
    entityId: z.string().min(1).max(80),
    op: z.enum(['upsert', 'delete']),
    note: z
      .object({
        title: z.string().max(NOTE_TITLE_MAX_LENGTH).nullable().optional(),
        body: z.string().max(NOTE_BODY_MAX_LENGTH).optional(),
        pinned: z.boolean().optional(),
        createdAt: isoDateTime.optional(),
        updatedAt: isoDateTime,
        deletedAt: isoDateTime.nullable().optional(),
        baseRev: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
    version: z
      .object({
        title: z.string().max(NOTE_TITLE_MAX_LENGTH).nullable().optional(),
        body: z.string().max(NOTE_BODY_MAX_LENGTH),
        source: z.enum(['auto', 'manual', 'restore', 'import']),
        label: z.string().max(VERSION_LABEL_MAX_LENGTH).nullable().optional(),
        createdAt: isoDateTime,
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.entity === 'note' && value.op === 'upsert' && !value.note) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'note 载荷缺失' });
    }
    if (value.entity === 'version' && value.op === 'upsert' && !value.version) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['version'], message: 'version 载荷缺失' });
    }
  });

export const syncPushRequestSchema = z
  .object({
    mutations: z.array(syncMutationSchema).max(SYNC_PAGE_SIZE),
  })
  .strict();

export type SyncPullRequestInput = z.infer<typeof syncPullRequestSchema>;
export type SyncPushRequestInput = z.infer<typeof syncPushRequestSchema>;
export type SyncMutationInput = z.infer<typeof syncMutationSchema>;
