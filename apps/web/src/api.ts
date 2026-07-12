import type {
  AdminRoomPlayerSummary,
  AdminRoomSummary,
  AdminUserSummary,
  RoomMode,
  RoomSettings,
  RoomStatus,
  UserRoomSummary,
  UserSession,
} from '@poker/protocol';

export class ApiError extends Error {
  public constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : `请求失败 (${response.status})`;
    throw new ApiError(response.status, message, body);
  }
  return body as T;
}

export interface AdminSession {
  id: string;
  username: string;
}

export interface CreateRoomResponse {
  roomId: string;
  inviteUrl: string;
}

export interface InvitePreview {
  roomId: string;
  name: string;
  mode: RoomMode;
  status: RoomStatus;
  settings: RoomSettings;
  playerCount: number;
  nicknames: string[];
}

export interface JoinResponse {
  roomId: string;
  playerId: string;
}

export interface PlayerSession {
  id: string;
  roomId: string;
  nickname: string;
  seat: number | null;
}

export type {
  AdminRoomPlayerSummary,
  AdminRoomSummary,
  AdminUserSummary,
  UserRoomSummary,
  UserSession,
};
