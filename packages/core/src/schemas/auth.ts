import { z } from 'zod';
import {
  DISPLAY_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SECURITY_QUESTION_COUNT,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from '../constants';
import { isKnownQuestionKey } from '../security-questions';

export const usernameSchema = z
  .string()
  .min(USERNAME_MIN_LENGTH)
  .max(USERNAME_MAX_LENGTH)
  .regex(/^[a-zA-Z0-9._-]+$/, '用户名只能包含字母、数字、下划线、点和连字符');

export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

export const devicePlatformSchema = z.enum([
  'web-desktop',
  'web-mobile',
  'android',
  'ios',
  'unknown',
]);

export const deviceInfoSchema = z
  .object({
    label: z.string().max(60).optional(),
    platform: devicePlatformSchema.optional(),
  })
  .strict();

export const registerRequestSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
    displayName: z.string().max(DISPLAY_NAME_MAX_LENGTH).optional(),
    device: deviceInfoSchema.optional(),
  })
  .strict();

export const loginRequestSchema = z
  .object({
    username: usernameSchema,
    password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    device: deviceInfoSchema.optional(),
  })
  .strict();

export const twoFaVerifyRequestSchema = z
  .object({
    challengeToken: z.string().min(16).max(512),
    code: z.string().min(6).max(32),
    trustDevice: z.boolean().optional(),
  })
  .strict();

export const recoveryStartRequestSchema = z
  .object({
    challengeToken: z.string().min(16).max(512),
  })
  .strict();

export const recoveryVerifyRequestSchema = z
  .object({
    recoveryToken: z.string().min(16).max(512),
    answer: z.string().min(1).max(200),
  })
  .strict();

export const changePasswordRequestSchema = z
  .object({
    /** Required for full sessions; omitted when the session came from security-question recovery. */
    currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH).optional(),
    newPassword: passwordSchema,
  })
  .strict();

export const twoFaEnableRequestSchema = z
  .object({
    code: z.string().min(6).max(32),
  })
  .strict();

export const twoFaDisableRequestSchema = z
  .object({
    password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  })
  .strict();

export const securityQuestionAnswerSchema = z
  .object({
    key: z.string().min(1).max(64),
    answer: z.string().min(1).max(200),
  })
  .strict();

export const securityQuestionsSetRequestSchema = z
  .object({
    answers: z.array(securityQuestionAnswerSchema).length(SECURITY_QUESTION_COUNT),
  })
  .strict()
  .superRefine((value, ctx) => {
    const keys = new Set<string>();
    for (const [index, entry] of value.answers.entries()) {
      if (!isKnownQuestionKey(entry.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['answers', index, 'key'],
          message: `未知的密保问题: ${entry.key}`,
        });
      }
      if (keys.has(entry.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['answers', index, 'key'],
          message: '密保问题不能重复',
        });
      }
      keys.add(entry.key);
    }
  });

export const updateProfileRequestSchema = z
  .object({
    displayName: z.string().min(1).max(DISPLAY_NAME_MAX_LENGTH),
  })
  .strict();

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type TwoFaVerifyRequest = z.infer<typeof twoFaVerifyRequestSchema>;
export type RecoveryStartRequest = z.infer<typeof recoveryStartRequestSchema>;
export type RecoveryVerifyRequest = z.infer<typeof recoveryVerifyRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type TwoFaEnableRequest = z.infer<typeof twoFaEnableRequestSchema>;
export type TwoFaDisableRequest = z.infer<typeof twoFaDisableRequestSchema>;
export type SecurityQuestionsSetRequest = z.infer<typeof securityQuestionsSetRequestSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
