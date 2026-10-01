/** Public DTOs returned by the API and mirrored by the offline store. */

export type ISODateString = string;

export type SessionScope = 'full' | 'recovery';
export type DevicePlatform = 'web-desktop' | 'web-mobile' | 'android' | 'ios' | 'unknown';
export type VersionSource = 'auto' | 'manual' | 'restore' | 'import';

export interface UserDto {
  id: string;
  username: string;
  displayName: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  twoFactorEnabled: boolean;
  /** When true, the account must re-provision every security question before normal use. */
  mustResetQuestions: boolean;
  /** How many unused security questions remain (drives the "running out" warning). */
  unusedSecurityQuestions: number;
}

export interface DeviceDto {
  id: string;
  label: string;
  platform: DevicePlatform;
  firstSeenAt: ISODateString;
  lastSeenAt: ISODateString;
  trusted: boolean;
  revokedAt: ISODateString | null;
  current: boolean;
}

export interface SessionDto {
  user: UserDto;
  device: DeviceDto;
  scope: SessionScope;
  expiresAt: ISODateString;
}

export interface NoteDto {
  id: string;
  title: string | null;
  body: string;
  pinned: boolean;
  /** Server-assigned, monotonically increasing per note. */
  rev: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  deletedAt: ISODateString | null;
  clientCreatedAt: ISODateString | null;
}

export interface NoteVersionDto {
  id: string;
  noteId: string;
  title: string | null;
  body: string;
  source: VersionSource;
  label: string | null;
  deviceId: string | null;
  bytes: number;
  pinned: boolean;
  /** Present on restore-created versions: the version it was restored from. */
  restoredFromId: string | null;
  createdAt: ISODateString;
}

/** Login is a multi-step negotiation; these are the possible outcomes. */
export type LoginResponse =
  | { status: 'authenticated'; session: SessionDto }
  | {
      status: 'two_fa_required';
      challengeToken: string;
      expiresAt: ISODateString;
      /** True when the account has unused security questions as a fallback. */
      recoveryAvailable: boolean;
    };

export interface SecurityQuestionPrompt {
  key: string;
  prompt: string;
}

export interface SecurityQuestionEntry {
  key: string;
  prompt: string;
  /** True when this slot has been answered and the answer has not been consumed. */
  active: boolean;
  consumedAt: ISODateString | null;
  createdAt: ISODateString | null;
}

export interface ChangeLogEntry {
  seq: number;
  entity: 'note' | 'version';
  entityId: string;
  op: 'upsert' | 'delete';
  rev: number;
  createdAt: ISODateString;
}

export interface SyncPullRequest {
  cursor: number;
  limit?: number;
}

export interface SyncPullResponse {
  cursor: number;
  hasMore: boolean;
  changes: ChangeLogEntry[];
  notes: NoteDto[];
  versions: NoteVersionDto[];
}

export interface SyncMutation {
  /** Client-generated id, echoed back so the outbox can be cleared unambiguously. */
  mutationId: string;
  entity: 'note' | 'version';
  entityId: string;
  op: 'upsert' | 'delete';
  /** For note upserts. */
  note?: {
    title?: string | null;
    body?: string;
    pinned?: boolean;
    createdAt?: ISODateString;
    updatedAt: ISODateString;
    deletedAt?: ISODateString | null;
    baseRev?: number;
  };
  /** For version upserts (client-captured snapshots). */
  version?: {
    title?: string | null;
    body: string;
    source: VersionSource;
    label?: string | null;
    createdAt: ISODateString;
  };
}

export interface SyncMutationResult {
  mutationId: string;
  status: 'applied' | 'conflict' | 'rejected';
  /** Server revision after applying (or the winning revision on conflict). */
  rev?: number;
  /** Set when a note upsert lost the race; the losing body is preserved as a version. */
  conflictVersionId?: string;
  error?: string;
  note?: NoteDto;
  version?: NoteVersionDto;
}

export interface SyncPushResponse {
  results: SyncMutationResult[];
  cursor: number;
}

export interface ProviderStatusDto {
  llm: { provider: string; configured: boolean };
  stt: { provider: string; configured: boolean };
  segmenter: { provider: string };
}
