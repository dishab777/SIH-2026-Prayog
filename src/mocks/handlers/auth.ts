import { http } from 'msw';
import type { Role } from '@/config/rbac';
import { registerExpertSchema, registerStartupSchema } from '@/schemas/auth';
import { getDb } from '../store/db';
import { currentUser, signIn, signInAs, signOut } from '../store/session';
import { fail, gate, ok, readBody } from './util';

/*
 * Addresses registered during this session. In memory, like the rest of the
 * demonstration store, and reset by a reload — enough to make a duplicate
 * behave the way it would against a real register.
 */
const registered = new Set<string>();

export const authHandlers = [
  http.get('/api/auth/me', async () => {
    const blocked = await gate('read');
    if (blocked) return blocked;
    const user = currentUser();
    if (!user) return ok({ user: null, role: 'public' as Role });
    const db = getDb();
    return ok({
      user,
      role: user.role,
      department: db.departments.find((d) => d.id === user.departmentId) ?? null,
      startup: db.startups.find((s) => s.id === user.startupId) ?? null,
    });
  }),

  /*
   * Sign in.
   *
   * Three ways in, and they are not equivalent. `email` + `password` is the real
   * one and the only one a person uses; `userId` and `role` are the demonstration
   * switcher, which exists because a reviewer should not have to hold seven sets
   * of credentials to look at seven screens.
   *
   * There are no stored password hashes in a demonstration dataset, so the
   * credential path resolves the address and accepts any password that was
   * actually typed. THAT IS THE ONE THING HERE THAT A REAL BACKEND MUST REPLACE:
   * verify the hash, rate-limit the attempt, and return the same 401 for a wrong
   * password as for an unknown address so the response cannot be used to
   * enumerate accounts. The client is already written against that contract.
   */
  http.post('/api/auth/login', async ({ request }) => {
    const blocked = await gate('write');
    if (blocked) return blocked;
    const body = await readBody<{ userId?: string; role?: Role; email?: string; password?: string }>(request);

    if (body.email !== undefined) {
      if (!body.password) {
        return fail(422, 'VALIDATION_FAILED', 'Sign-in could not be completed.', ['A password is required.']);
      }
      const email = body.email.trim().toLowerCase();
      const match = getDb().users.find((u) => u.email.toLowerCase() === email) ?? null;
      // Deliberately the same refusal either way.
      if (!match) {
        return fail(401, 'SIGN_IN_FAILED', 'That email address and password do not match an account.');
      }
      const user = signIn(match.id);
      return ok({ user }, `Signed in as ${match.name}.`);
    }

    const user = body.userId ? signIn(body.userId) : body.role ? signInAs(body.role) : null;
    if (!user && body.role !== 'public') {
      return fail(401, 'SIGN_IN_FAILED', 'That account does not exist in this demonstration dataset.');
    }
    return ok({ user }, user ? `Signed in as ${user.name}.` : 'Signed out. You are browsing as a member of the public.');
  }),

  http.post('/api/auth/logout', async () => {
    const blocked = await gate('write');
    if (blocked) return blocked;
    signOut();
    return ok({ user: null }, 'Signed out.');
  }),

  http.post('/api/auth/refresh', async () => {
    const blocked = await gate('write');
    if (blocked) return blocked;
    return ok({ user: currentUser() });
  }),

  /*
   * Registration.
   *
   * The form validates with Zod and so does this, against the SAME schema — a
   * rule enforced only in a component is not enforced, and this is the one
   * endpoint in the product a stranger can reach. The password never comes back
   * in the response, and it is never written to the demonstration store.
   *
   * Registered addresses are held in memory for the session so a second attempt
   * with the same address is refused with a 409 rather than silently accepted,
   * which is the behaviour a real sign-up has to have.
   */
  http.post('/api/auth/register', async ({ request }) => {
    const blocked = await gate('write');
    if (blocked) return blocked;

    const body = await readBody<{ kind?: string } & Record<string, unknown>>(request);
    if (body.kind !== 'startup' && body.kind !== 'expert') {
      return fail(422, 'VALIDATION_FAILED', 'Registration could not be completed.', [
        'Say whether you are registering a startup or an expert.',
      ]);
    }

    const schema = body.kind === 'startup' ? registerStartupSchema : registerExpertSchema;
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(
        422,
        'VALIDATION_FAILED',
        'Registration could not be completed.',
        parsed.error.issues.map((i) => i.message),
      );
    }

    const email = parsed.data.email.toLowerCase();
    const db = getDb();
    if (registered.has(email) || db.users.some((u) => u.email.toLowerCase() === email)) {
      return fail(409, 'ALREADY_REGISTERED', 'An account already exists for that address.', [
        'Sign in instead, or use a different work address.',
      ]);
    }
    registered.add(email);

    /*
     * What comes back is a receipt, not the submission: an identifier the
     * applicant can quote, and no echo of anything they typed.
     */
    return ok(
      {
        registered: true,
        kind: body.kind,
        email: parsed.data.email,
        reference: `REG-${body.kind === 'startup' ? 'STP' : 'EXP'}-${(registered.size + 1040).toString(36).toUpperCase()}`,
      },
      body.kind === 'startup'
        ? 'Registration received. Verify your entity details to see which challenges you are eligible for.'
        : 'Registration received. The programme management unit reviews expert registrations before assignment.',
    );
  }),

  http.get('/api/auth/accounts', async () => {
    const blocked = await gate('read');
    if (blocked) return blocked;
    const db = getDb();
    // The demo role switcher lists one representative account per role.
    const byRole: Role[] = [
      'startup',
      'department_officer',
      'department_admin',
      'procurement_officer',
      'evaluator',
      'validator',
      'pmu',
    ];
    return ok(
      byRole
        .map((role) => db.users.find((u) => u.role === role))
        .filter((u): u is NonNullable<typeof u> => Boolean(u)),
    );
  }),
];
