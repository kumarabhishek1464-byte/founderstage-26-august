/**
 * Authorization. **One module, no exceptions.**
 *
 * §36 of the specification: never `if (member.role === 'admin')` scattered across
 * components. Every affordance — the "Add people" button, the swipe-to-delete on someone
 * else's message, the role picker in the member sheet — asks `can()`. That is not tidiness:
 * a role check written inline is a check that will not be updated when the role matrix gains
 * `moderator`, and the failure mode is a button that is visible and then rejected.
 *
 * ## This copy is not authoritative
 *
 * The server's copy — `messaging.has_permission()`, created in
 * `supabase/migrations/0009_permissions.sql` — decides. This module exists **only** to hide
 * affordances a user cannot use, so the UI does not offer an action that will be refused.
 * A client that patched this file to return `true` for everything would gain nothing: every
 * mutation goes through a `SECURITY DEFINER` RPC that re-derives the same answer from the
 * database's own membership rows. The two copies must agree, and
 * `supabase/tests/permissions.test.sql` asserts the matrix below against the SQL one.
 *
 * ## Why thresholds rather than a role→permission boolean matrix
 *
 * A boolean matrix is 4 roles × 13 permissions = 52 cells, most of them redundant because
 * the roles are a hierarchy: anything a moderator may do, an admin and an owner may do. The
 * only information in those 52 cells is, for each permission, **the weakest role that has
 * it**. Stating that directly makes the table 13 entries, makes it impossible to write the
 * incoherent cell (a member who may delete any message but an admin who may not), and makes
 * a per-conversation override a change to a threshold rather than a merge of two matrices.
 *
 * ## Why some permissions cannot be overridden
 *
 * `group.change_permissions` is fixed at `owner` and is absent from
 * {@link OVERRIDABLE_PERMISSIONS}. If an admin could lower the threshold for changing
 * permissions, they could lower it to `member`, and from there every other threshold is
 * reachable — the classic privilege-escalation-through-configuration hole. The same argument
 * applies to `member.change_role`: an admin who could make role changes available to members
 * has effectively granted ownership. Both are enforced again in SQL, because a threshold
 * the client refuses to write is not the same as one the server refuses to accept.
 */
import { GROUP_ROLES } from './enums';

import type { ConversationType, GroupRole, MembershipState } from './enums';

/**
 * Namespaced `subject.verb` strings. The namespace is not decoration: it is what lets the
 * permissions sheet group thresholds under "Messages", "Members" and "Group" without a
 * second mapping table, and it keeps `delete_own` from colliding when attachments grow
 * their own permissions.
 */
export const PERMISSIONS = [
  'message.send',
  'message.edit_own',
  'message.delete_own',
  'message.delete_any',
  'message.pin',
  'message.react',
  'member.add',
  'member.remove',
  'member.change_role',
  'group.edit_info',
  'group.change_permissions',
  'invite.create',
  'invite.revoke',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * The weakest role that holds each permission when a conversation has said nothing.
 *
 * `message.send` at `member` is what makes a group a conversation rather than a broadcast;
 * raising it to `admin` via an override is how "announcement mode" is expressed, with no new
 * concept and no `isAnnouncement` boolean.
 */
const DEFAULT_THRESHOLD: Readonly<Record<Permission, GroupRole>> = {
  'message.send': 'member',
  'message.edit_own': 'member',
  'message.delete_own': 'member',
  'message.react': 'member',

  // Moderation: cleaning up someone else's content, without the power to restructure who is
  // in the room.
  'message.delete_any': 'moderator',
  'message.pin': 'moderator',

  'member.add': 'admin',
  'member.remove': 'admin',
  'member.change_role': 'admin',
  'group.edit_info': 'admin',
  'invite.create': 'admin',
  'invite.revoke': 'admin',

  // See the module docblock — fixed, and not overridable.
  'group.change_permissions': 'owner',
};

/**
 * The thresholds a group may move. Anything absent is fixed at its default forever.
 *
 * A `Set` rather than a filter over `PERMISSIONS`, so the list is a statement rather than a
 * derivation — the security property is "these and no others", and a predicate would let a
 * later edit widen the set as a side effect.
 */
export const OVERRIDABLE_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  'message.send',
  'message.edit_own',
  'message.delete_own',
  'message.delete_any',
  'message.pin',
  'member.add',
  'member.remove',
  'group.edit_info',
  'invite.create',
  'invite.revoke',
]);

/**
 * A conversation's threshold overrides. Sparse — absent means "use the default".
 *
 * Stored as one `jsonb` column rather than a row per override, because it is read on every
 * permission check and is always read whole.
 */
export type ConversationPermissionOverrides = Partial<Readonly<Record<Permission, GroupRole>>>;

/**
 * The permissions that mean anything in a 1:1 conversation.
 *
 * Everything else is group management, and a `direct` conversation has no roles, no
 * membership changes and no title. Returning `false` for those rather than letting the
 * threshold table answer is the difference between "you may not do that" and "there is no
 * such thing here" — and it means a bug that renders the group header on a DM shows an empty
 * toolbar rather than a broken one.
 *
 * `message.pin` is included: pinning works in a DM and both participants may do it.
 */
const DIRECT_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  'message.send',
  'message.edit_own',
  'message.delete_own',
  'message.react',
  'message.pin',
]);

/**
 * Position in the hierarchy. `GROUP_ROLES` is ordered weakest → strongest, so the index *is*
 * the rank — which is why that array's order is documented as load-bearing.
 */
export function roleRank(role: GroupRole): number {
  return GROUP_ROLES.indexOf(role);
}

/** Just enough of a membership row to decide. Structural, so a full member object satisfies it. */
export interface PermissionActor {
  readonly role: GroupRole;
  readonly state: MembershipState;
}

/** Just enough of a conversation. */
export interface PermissionScope {
  readonly type: ConversationType;
  readonly overrides: ConversationPermissionOverrides;
}

/**
 * The threshold in force for a permission in a given conversation.
 *
 * Exported because the group-permissions screen renders exactly this — the current threshold
 * per overridable permission — and recomputing it there would be a second copy of the
 * override-versus-default precedence.
 */
export function thresholdFor(permission: Permission, scope: PermissionScope): GroupRole {
  const fallback = DEFAULT_THRESHOLD[permission];
  if (!OVERRIDABLE_PERMISSIONS.has(permission)) return fallback;

  return scope.overrides[permission] ?? fallback;
}

/**
 * The one question every component asks.
 *
 * Note what is *not* a parameter: the target message or member. `can()` answers "does this
 * actor hold this power in this conversation at all", and ownership questions
 * (`message.delete_own` on a message you did not write) are a separate, obvious check at the
 * call site. Folding them in would mean every caller passes a target even where there is
 * none, and `can(actor, 'member.add', scope, undefined)` reads worse than the two checks it
 * replaces.
 */
export function can(
  actor: PermissionActor,
  permission: Permission,
  scope: PermissionScope
): boolean {
  // A member who left or was removed retains read access to history and no power at all.
  // Checked first, so no threshold or conversation-type nuance can accidentally grant
  // something to a non-member.
  if (actor.state !== 'active') return false;

  if (scope.type === 'direct') return DIRECT_PERMISSIONS.has(permission);

  return roleRank(actor.role) >= roleRank(thresholdFor(permission, scope));
}

/**
 * Whether `actor` may act on `target` at all — remove them, or change their role.
 *
 * Strictly greater, not greater-or-equal. Two admins who can demote each other is a fight,
 * not a hierarchy, and the state it produces (a group whose last two admins removed each
 * other) has no recovery path. An owner therefore cannot be removed by anyone; ownership is
 * transferred, and only by the owner.
 */
export function canActOn(actor: PermissionActor, target: PermissionActor): boolean {
  if (actor.state !== 'active') return false;

  return roleRank(actor.role) > roleRank(target.role);
}

/**
 * Whether `actor` may move `target` to `nextRole`.
 *
 * Three conditions, and the third is the one that is easy to miss: an admin may not promote
 * someone **to** admin, because that creates a peer they can no longer act on and is
 * therefore a one-way grant of their own authority. Promotion to a rank is reserved for
 * roles strictly above it.
 *
 * Ownership transfer is deliberately not expressible here — it changes two rows (the old
 * owner becomes an admin) and is its own RPC, not a role assignment.
 */
export function canAssignRole(
  actor: PermissionActor,
  target: PermissionActor,
  nextRole: GroupRole,
  scope: PermissionScope
): boolean {
  if (!can(actor, 'member.change_role', scope)) return false;
  if (!canActOn(actor, target)) return false;
  if (nextRole === 'owner') return false;

  return roleRank(actor.role) > roleRank(nextRole);
}
