/**
 * Whose file is this?
 *
 * RBAC answers one question: may this role do this kind of thing to this kind
 * of record. It cannot answer the question a procurement file actually turns
 * on — is this *your* case. A nodal officer in Pune holds exactly the same
 * permissions as a nodal officer in Kota, and neither of them may open the
 * other's challenge, read the other's applicants, or see what the other is
 * about to pay. Permission and jurisdiction are different things, and a system
 * that only checks the first one is a system where a link is an authorisation.
 *
 * So this is the second check. It runs on the API for every request under
 * /api, before any handler sees it, which means a record you have no standing
 * to read is refused however you arrived at it: a notification, an alert, a
 * stale bookmark, a link somebody pasted, a redirect after signing in. There is
 * no path through the interface that reaches around it, because the interface
 * is not where it lives.
 *
 * Nothing here is hardcoded into a component or an endpoint. `REACH` is the
 * entire policy, and /a/users renders it, so the rule the programme enforces is
 * a rule anyone taking part can go and read.
 */
import type { Role } from './rbac';

/**
 * How far a person's standing extends.
 *
 * Read as a sentence: a department officer's writ runs over their own
 * department, an evaluator's over the cases handed to them by name.
 */
export type Reach =
  | 'programme'
  | 'state'
  | 'department'
  | 'assigned'
  | 'own'
  | 'none';

export const REACH: Readonly<Record<Role, Reach>> = {
  public: 'none',
  startup: 'own',
  department_officer: 'department',
  department_admin: 'department',
  procurement_officer: 'department',
  evaluator: 'assigned',
  validator: 'assigned',
  pmu: 'programme',
};

export interface ReachDefinition {
  id: Reach;
  label: string;
  /** What it covers, in the words a refusal uses. */
  description: string;
}

export const REACHES: readonly ReachDefinition[] = [
  {
    id: 'programme',
    label: 'The whole programme',
    description:
      'Every department, every case. The unit that writes the rules has to be able to audit them being followed.',
  },
  {
    id: 'state',
    label: 'One state',
    description: 'Every department within a single state, and nothing outside it.',
  },
  {
    id: 'department',
    label: 'One department',
    description:
      'The department a person is posted to: its challenges, its applicants, its pilots and its payments. Another department’s file is refused, including its drafts, its shortlists and its money.',
  },
  {
    id: 'assigned',
    label: 'Cases assigned by name',
    description:
      'Only the applications or pilots handed to this person. Independence is the point of the role, so the rest of the programme is closed to them.',
  },
  {
    id: 'own',
    label: 'Their own record',
    description:
      'A company’s own applications, pilots, contracts and payments — and every challenge that has been published, which is what they came for.',
  },
  {
    id: 'none',
    label: 'Published record only',
    description: 'What the programme has published to the open web. No case file, no applicant, no company.',
  },
] as const;

export function reachOf(role: Role): Reach {
  // Same reasoning as `reachLabel` below: the role is typed, but every value of
  // it comes off the wire. A role this build has not heard of reaches nothing.
  return REACH[role] ?? 'none';
}

/**
 * How far a role reaches, in words.
 *
 * Defensive about the role, deliberately. `role` is typed as `Role`, but every
 * value of it arrives from the API at run time, and a server that returns a
 * role this build has never heard of used to take the whole page down: `REACH`
 * missed, the lookup missed, and the caller did `.toLowerCase()` on undefined.
 *
 * An unknown role is not a crash. It is somebody whose reach this build cannot
 * describe, which is exactly what "none" already means.
 */
export function reachLabel(role: Role): string {
  const id: Reach = REACH[role] ?? 'none';
  return REACHES.find((r) => r.id === id)?.label ?? id;
}
