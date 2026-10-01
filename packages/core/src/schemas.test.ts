import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import {
  SECURITY_QUESTION_CATALOG,
  isKnownQuestionKey,
  questionPrompt,
} from './security-questions';
import { registerRequestSchema, securityQuestionsSetRequestSchema } from './schemas/auth';
import { noteCreateRequestSchema, versionPatchRequestSchema } from './schemas/notes';
import { syncMutationSchema } from './schemas/sync';

describe('security question catalog', () => {
  it('has unique keys', () => {
    const keys = SECURITY_QUESTION_CATALOG.map((question) => question.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('recognises known keys and falls back for unknown ones', () => {
    expect(isKnownQuestionKey('first_pet')).toBe(true);
    expect(isKnownQuestionKey('nope')).toBe(false);
    expect(questionPrompt('nope')).toBe('nope');
  });
});

describe('registerRequestSchema', () => {
  it('accepts a valid payload', () => {
    const result = registerRequestSchema.safeParse({
      username: 'alice_01',
      password: 'a-very-long-password',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a short password', () => {
    expect(registerRequestSchema.safeParse({ username: 'alice', password: 'short' }).success).toBe(
      false,
    );
  });

  it('rejects usernames with unsupported characters', () => {
    expect(
      registerRequestSchema.safeParse({ username: '有中文', password: 'a-very-long-password' })
        .success,
    ).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(
      registerRequestSchema.safeParse({
        username: 'alice',
        password: 'a-very-long-password',
        isAdmin: true,
      }).success,
    ).toBe(false);
  });
});

describe('securityQuestionsSetRequestSchema', () => {
  it('requires exactly three distinct known questions', () => {
    const ok = securityQuestionsSetRequestSchema.safeParse({
      answers: [
        { key: 'first_pet', answer: 'a' },
        { key: 'childhood_street', answer: 'b' },
        { key: 'favorite_book', answer: 'c' },
      ],
    });
    expect(ok.success).toBe(true);

    const duplicated = securityQuestionsSetRequestSchema.safeParse({
      answers: [
        { key: 'first_pet', answer: 'a' },
        { key: 'first_pet', answer: 'b' },
        { key: 'favorite_book', answer: 'c' },
      ],
    });
    expect(duplicated.success).toBe(false);

    const tooFew = securityQuestionsSetRequestSchema.safeParse({
      answers: [{ key: 'first_pet', answer: 'a' }],
    });
    expect(tooFew.success).toBe(false);
  });
});

describe('notes schemas', () => {
  it('requires a body when creating a note', () => {
    expect(noteCreateRequestSchema.safeParse({ body: '' }).success).toBe(true);
    expect(noteCreateRequestSchema.safeParse({}).success).toBe(false);
  });

  it('accepts an empty version patch', () => {
    expect(versionPatchRequestSchema.safeParse({}).success).toBe(true);
    expect(versionPatchRequestSchema.safeParse({ pinned: true, label: null }).success).toBe(true);
  });
});

describe('syncMutationSchema', () => {
  it('requires a note payload for note upserts', () => {
    const result = syncMutationSchema.safeParse({
      mutationId: 'm1',
      entity: 'note',
      entityId: 'n1',
      op: 'upsert',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a delete without a payload', () => {
    const result = syncMutationSchema.safeParse({
      mutationId: 'm2',
      entity: 'note',
      entityId: 'n1',
      op: 'delete',
    });
    expect(result.success).toBe(true);
  });
});

describe('ApiError', () => {
  it('carries a machine-readable code and an HTTP status', () => {
    const error = new ApiError('two_fa_invalid', '验证码不正确');
    expect(error.code).toBe('two_fa_invalid');
    expect(error.status).toBe(401);
  });
});
