import type { DeviceRow, SessionRow, UserRow } from '../db/types';
import type { Env } from '../env';

export interface AuthContext {
  session: SessionRow;
  user: UserRow;
  device: DeviceRow;
  /** True until the account re-provisions every security question after a recovery login. */
  mustResetQuestions: boolean;
}

export interface AppVariables {
  requestId: string;
  ipHash: string | null;
  uaHash: string | null;
  auth: AuthContext | null;
}

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};
