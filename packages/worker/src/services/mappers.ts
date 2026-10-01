import type { DeviceDto, NoteDto, NoteVersionDto, SessionDto, UserDto } from '@luminote/core';
import type { NoteRow, NoteVersionRow, DeviceRow, UserRow } from '../db/types';
import type { AuthContext } from '../http/context';

export function toUserDto(
  user: UserRow,
  extra: { unusedSecurityQuestions: number; mustResetQuestions: boolean },
): UserDto {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    twoFactorEnabled: user.two_factor_enabled === 1,
    mustResetQuestions: extra.mustResetQuestions,
    unusedSecurityQuestions: extra.unusedSecurityQuestions,
  };
}

export function toDeviceDto(device: DeviceRow, currentDeviceId: string): DeviceDto {
  return {
    id: device.id,
    label: device.label,
    platform: device.platform,
    firstSeenAt: device.first_seen_at,
    lastSeenAt: device.last_seen_at,
    trusted: device.trusted === 1,
    revokedAt: device.revoked_at,
    current: device.id === currentDeviceId,
  };
}

export function toNoteDto(row: NoteRow): NoteDto {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    pinned: row.pinned === 1,
    rev: row.rev,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    clientCreatedAt: row.client_created_at,
  };
}

export function toVersionDto(row: NoteVersionRow): NoteVersionDto {
  return {
    id: row.id,
    noteId: row.note_id,
    title: row.title,
    body: row.body,
    source: row.source,
    label: row.label,
    deviceId: row.device_id,
    bytes: row.bytes,
    pinned: row.pinned === 1,
    restoredFromId: row.restored_from_id,
    createdAt: row.created_at,
  };
}

export function toSessionDto(
  auth: AuthContext,
  user: UserRow,
  unusedSecurityQuestions: number,
): SessionDto {
  return {
    user: toUserDto(user, {
      unusedSecurityQuestions,
      mustResetQuestions: auth.mustResetQuestions,
    }),
    device: toDeviceDto(auth.device, auth.device.id),
    scope: auth.session.scope,
    expiresAt: auth.session.expires_at,
  };
}
