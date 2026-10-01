import type {
  DeviceDto,
  LoginResponse,
  SecurityQuestionEntry,
  SecurityQuestionPrompt,
  SessionDto,
} from '@luminote/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { detectDevice } from './device';

export const sessionQueryKey = ['session'] as const;

export interface SessionQueryResult {
  session: SessionDto | null;
  /** True when the account must re-provision security questions before anything else works. */
  needsQuestionReset: boolean;
}

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: async (): Promise<SessionQueryResult> => {
      try {
        const result = await apiFetch<{ session: SessionDto }>('/api/v1/auth/session');
        return {
          session: result.session,
          needsQuestionReset: result.session.user.mustResetQuestions,
        };
      } catch {
        return { session: null, needsQuestionReset: false };
      }
    },
    staleTime: 30_000,
    retry: false,
  });
}

function devicePayload() {
  const device = detectDevice();
  return { label: device.label, platform: device.platform };
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { username: string; password: string; displayName?: string }) =>
      apiFetch<LoginResponse>('/api/v1/auth/register', {
        method: 'POST',
        json: { ...input, device: devicePayload() },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { username: string; password: string }) =>
      apiFetch<LoginResponse>('/api/v1/auth/login', {
        method: 'POST',
        json: { ...input, device: devicePayload() },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
  });
}

export function useVerifyTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { challengeToken: string; code: string; trustDevice?: boolean }) =>
      apiFetch<LoginResponse>('/api/v1/auth/2fa/verify', { method: 'POST', json: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
  });
}

export function useStartRecovery() {
  return useMutation({
    mutationFn: (challengeToken: string) =>
      apiFetch<{
        recoveryToken: string;
        expiresAt: string;
        question: SecurityQuestionPrompt;
      }>('/api/v1/auth/recovery/start', { method: 'POST', json: { challengeToken } }),
  });
}

export function useVerifyRecovery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { recoveryToken: string; answer: string }) =>
      apiFetch<LoginResponse>('/api/v1/auth/recovery/verify', { method: 'POST', json: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ ok: true }>('/api/v1/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      // Writing the signed-out result first matters: `clear()` on its own removes the query while
      // a mounted observer keeps rendering its last successful result, which would leave the
      // workspace on screen until the page was reloaded.
      queryClient.setQueryData<SessionQueryResult>(sessionQueryKey, {
        session: null,
        needsQuestionReset: false,
      });
      // Then drop everything else so no account data survives on a shared device.
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== sessionQueryKey[0],
      });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword?: string; newPassword: string }) =>
      apiFetch<{ ok: true }>('/api/v1/auth/password', { method: 'POST', json: input }),
  });
}

export function useSecurityQuestions() {
  return useQuery({
    queryKey: ['security-questions'],
    queryFn: () =>
      apiFetch<{
        catalog: SecurityQuestionPrompt[];
        entries: SecurityQuestionEntry[];
        mustResetQuestions: boolean;
      }>('/api/v1/me/security-questions'),
  });
}

export function useSetSecurityQuestions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answers: Array<{ key: string; answer: string }>) =>
      apiFetch<{ session: SessionDto }>('/api/v1/me/security-questions', {
        method: 'PUT',
        json: { answers },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      void queryClient.invalidateQueries({ queryKey: ['security-questions'] });
    },
  });
}

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: () => apiFetch<{ devices: DeviceDto[] }>('/api/v1/me/devices'),
  });
}

export function useRevokeDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) =>
      apiFetch<{ devices: DeviceDto[] }>(`/api/v1/me/devices/${deviceId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });
}

export function useTwoFactorSetup() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ secret: string; uri: string }>('/api/v1/me/2fa/setup', { method: 'POST' }),
  });
}

export function useEnableTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<{ backupCodes: string[]; session: SessionDto }>('/api/v1/me/2fa/enable', {
        method: 'POST',
        json: { code },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
  });
}

export function useDisableTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) =>
      apiFetch<{ session: SessionDto }>('/api/v1/me/2fa/disable', {
        method: 'POST',
        json: { password },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) =>
      apiFetch<{ session: SessionDto }>('/api/v1/me', {
        method: 'PATCH',
        json: { displayName },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
  });
}

export function useProviderStatus() {
  return useQuery({
    queryKey: ['provider-status'],
    queryFn: () =>
      apiFetch<{
        llm: { provider: string; configured: boolean };
        stt: { provider: string; configured: boolean };
        segmenter: { provider: string };
      }>('/api/v1/providers/status'),
    staleTime: 5 * 60_000,
  });
}
