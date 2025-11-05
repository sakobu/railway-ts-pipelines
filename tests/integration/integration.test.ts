import { describe, test, expect } from 'bun:test';

import { pipe } from '@/composition';
import {
  ok,
  err,
  isOk,
  isErr,
  mapToResult,
  fromNullableOption,
  mapErrorResult,
  flatMapResult,
  fromTry,
  type Option,
  type Result,
} from '@/index';

describe('Railway-TS Integration', () => {
  test('user authentication flow combining Option and Result', () => {
    type User = {
      id: string;
      username: string;
      passwordHash: string;
      isActive: boolean;
    };

    type AuthError =
      | { type: 'NOT_FOUND'; message: string }
      | { type: 'INVALID_CREDENTIALS'; message: string }
      | { type: 'ACCOUNT_INACTIVE'; message: string }
      | { type: 'TOKEN_GENERATION_FAILED'; message: string };

    type AuthToken = {
      token: string;
      expiresAt: Date;
    };

    // Mock database
    const users: Record<string, User> = {
      user123: {
        id: 'user123',
        username: 'johndoe',
        passwordHash: 'hashed_password123',
        isActive: true,
      },
      user456: {
        id: 'user456',
        username: 'janedoe',
        passwordHash: 'hashed_password456',
        isActive: false,
      },
    };

    // Find a user by username (returns Option)
    const findUserByUsername = (username: string): Option<User> => {
      const user = Object.values(users).find((u) => u.username === username);
      return fromNullableOption(user);
    };

    // Validate user credentials and convert to Result
    const validateCredentials = (user: User, password: string): Result<User, AuthError> => {
      // Simulate password validation
      const isPasswordValid = password === 'password123';

      if (!isPasswordValid) {
        return err({
          type: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        });
      }

      if (!user.isActive) {
        return err({
          type: 'ACCOUNT_INACTIVE',
          message: 'Account is inactive',
        });
      }

      return ok(user);
    };

    // Generate auth token using Railway-ts patterns
    const generateAuthToken = (user: User): Result<AuthToken, AuthError> => {
      return pipe(
        fromTry(() => {
          // Simulate token generation
          const token = `token_${user.id}_${Date.now()}`;
          const expiresAt = new Date(Date.now() + 3_600_000); // 1 hour
          return { token, expiresAt };
        }),
        // Map the standard Error to our specific AuthError type
        (result) =>
          mapErrorResult(result, () => ({
            type: 'TOKEN_GENERATION_FAILED',
            message: 'Failed to generate auth token',
          })),
      );
    };

    // Main authentication function combining all steps
    const authenticateUser = (username: string, password: string): Result<AuthToken, AuthError> => {
      // First find the user (Option)
      const userOption = findUserByUsername(username);

      // Convert Option to Result with appropriate error
      return pipe(
        mapToResult(userOption, {
          type: 'NOT_FOUND',
          message: 'User not found',
        } as AuthError),
        // Validate credentials
        (result) => flatMapResult(result, (user) => validateCredentials(user, password)),
        // Generate token if validation succeeded
        (result) => flatMapResult(result, (user) => generateAuthToken(user)),
      );
    };

    // Test with existing active user
    const successResult = authenticateUser('johndoe', 'password123');
    expect(isOk(successResult)).toBe(true);
    if (isOk(successResult)) {
      expect(successResult.value.token).toContain('token_user123_');
      expect(successResult.value.expiresAt).toBeInstanceOf(Date);
    }

    // Test with inactive user
    const inactiveResult = authenticateUser('janedoe', 'password123');
    expect(isErr(inactiveResult)).toBe(true);
    if (isErr(inactiveResult)) {
      expect(inactiveResult.error.type).toBe('ACCOUNT_INACTIVE');
    }

    // Test with non-existent user
    const notFoundResult = authenticateUser('nonexistent', 'password123');
    expect(isErr(notFoundResult)).toBe(true);
    if (isErr(notFoundResult)) {
      expect(notFoundResult.error.type).toBe('NOT_FOUND');
    }
  });
});
