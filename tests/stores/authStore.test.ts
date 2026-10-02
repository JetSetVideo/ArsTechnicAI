/**
 * Auth Store Unit Tests
 *
 * The persisted JWT session store (stores/authStore):
 * - setAuth / clearAuth / updateUser
 * - expiry window (5 min margin) and Bearer header gating
 * - persistence key + rehydration dropping expired sessions
 * - bad expiresIn values fall back to the 7-day default
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAuthStore, DEFAULT_EXPIRY_MS, type AuthUser } from '../../stores/authStore';

const user: AuthUser = {
  id: 'u1',
  email: 'test@example.test',
  firstName: 'Test',
  lastName: 'User',
  pseudonym: 'tester',
  profileImage: null,
  roles: ['USER'],
};

const HOUR = 60 * 60 * 1000;

describe('AuthStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
    useAuthStore.getState().clearAuth();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores user, token and absolute expiry', () => {
    useAuthStore.getState().setAuth(user, 'tok', HOUR);
    const s = useAuthStore.getState();
    expect(s.user?.roles).toEqual(['USER']);
    expect(s.token).toBe('tok');
    expect(s.isAuthenticated).toBe(true);
    expect(s.tokenExpiresAt).toBe(Date.now() + HOUR);
    expect(s.isSessionValid()).toBe(true);
    expect(s.getAuthHeader()).toEqual({ Authorization: 'Bearer tok' });
  });

  it('treats a token within 5 minutes of expiry as invalid and sends no header', () => {
    useAuthStore.getState().setAuth(user, 'tok', HOUR);
    vi.advanceTimersByTime(HOUR - 5 * 60 * 1000);
    expect(useAuthStore.getState().isSessionValid()).toBe(false);
    expect(useAuthStore.getState().getAuthHeader()).toEqual({});
  });

  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'falls back to the 7-day default for expiresIn=%s',
    (bad) => {
      useAuthStore.getState().setAuth(user, 'tok', bad as number | undefined);
      expect(useAuthStore.getState().tokenExpiresAt).toBe(Date.now() + DEFAULT_EXPIRY_MS);
    }
  );

  it('updateUser merges fields and is a no-op when signed out', () => {
    useAuthStore.getState().updateUser({ pseudonym: 'ghost' });
    expect(useAuthStore.getState().user).toBeNull();

    useAuthStore.getState().setAuth(user, 'tok', HOUR);
    useAuthStore.getState().updateUser({ pseudonym: 'renamed' });
    expect(useAuthStore.getState().user).toMatchObject({ pseudonym: 'renamed', email: user.email });
  });

  it('clearAuth wipes the session', () => {
    useAuthStore.getState().setAuth(user, 'tok', HOUR);
    useAuthStore.getState().clearAuth();
    const s = useAuthStore.getState();
    expect([s.user, s.token, s.tokenExpiresAt, s.isAuthenticated]).toEqual([null, null, null, false]);
  });

  it('persists only session fields under "ars-auth"', () => {
    useAuthStore.getState().setAuth(user, 'tok', HOUR);
    const raw = JSON.parse(localStorage.getItem('ars-auth') ?? '{}');
    expect(Object.keys(raw.state).sort()).toEqual(['isAuthenticated', 'token', 'tokenExpiresAt', 'user']);
  });

  it('restores a live session and drops an expired one on rehydrate', async () => {
    const save = (expiresAt: number) =>
      localStorage.setItem(
        'ars-auth',
        JSON.stringify({ state: { user, token: 'tok', tokenExpiresAt: expiresAt, isAuthenticated: true }, version: 0 })
      );

    save(Date.now() + HOUR);
    await useAuthStore.persist.rehydrate();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    save(Date.now() + 60 * 1000); // inside the 5-minute margin
    await useAuthStore.persist.rehydrate();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });
});
