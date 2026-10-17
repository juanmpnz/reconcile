import { useMutation } from '@tanstack/react-query';
import { authClient } from '../../lib/auth';
import { authenticationChanged } from '../../lib/auth-events';
export class AuthMutationError extends Error {
  constructor(readonly code: string) {
    super(
      'No pudimos completar la autenticación. Revisá los datos e intentá nuevamente.',
    );
    this.name = 'AuthMutationError';
  }
}
export function unwrapAuth<T>(result: {
  data: T | null;
  error: { code?: string | undefined } | null;
}) {
  if (result.error)
    throw new AuthMutationError(result.error.code ?? 'AUTH_FAILED');
  return result.data;
}
// Credentials are transient; completed auth mutations are reset and garbage-collected immediately.
function useAuthMutation<T, V>(
  action: (input: V) => Promise<T>,
  changesSession = false,
) {
  const mutation = useMutation({
    mutationFn: action,
    retry: false,
    gcTime: 0,
    onSuccess: (data) => {
      const challenge =
        data &&
        typeof data === 'object' &&
        'twoFactorRedirect' in data &&
        data.twoFactorRedirect === true;
      if (changesSession && !challenge) authenticationChanged();
    },
    onSettled: (): void => {
      mutation.reset();
    },
  });
  return mutation;
}
export const useSignInMutation = () =>
  useAuthMutation(
    async (input: Parameters<typeof authClient.signIn.email>[0]) =>
      unwrapAuth(await authClient.signIn.email(input)),
    true,
  );
export const useSignUpMutation = () =>
  useAuthMutation(
    async (input: Parameters<typeof authClient.signUp.email>[0]) =>
      unwrapAuth(await authClient.signUp.email(input)),
  );
export const useRequestPasswordResetMutation = () =>
  useAuthMutation(
    async (input: Parameters<typeof authClient.requestPasswordReset>[0]) =>
      unwrapAuth(await authClient.requestPasswordReset(input)),
  );
export const useResetPasswordMutation = () =>
  useAuthMutation(
    async (input: Parameters<typeof authClient.resetPassword>[0]) =>
      unwrapAuth(await authClient.resetPassword(input)),
    true,
  );
export const useSendVerificationEmailMutation = () =>
  useAuthMutation(
    async (input: Parameters<typeof authClient.sendVerificationEmail>[0]) =>
      unwrapAuth(await authClient.sendVerificationEmail(input)),
  );
export const useSignOutMutation = () =>
  useAuthMutation(async () => unwrapAuth(await authClient.signOut()), true);
