/**
 * The `RealtimeTransport` port.
 *
 * One socket, many channels, and **no knowledge of messaging**. This module knows about
 * channels, broadcast, presence, connection status and gaps; it does not know that a channel
 * might be a conversation or that a payload might be a message. That separation is what
 * ADR-0006's "Realtime is opt-in per channel for notifications and messaging only" requires
 * — notifications will subscribe here too, and a transport typed against a message union
 * would have to grow a second union to let them.
 *
 * Consequently `payload` is `unknown`. The caller validates it with a Zod schema it owns
 * (`src/features/messaging/api/realtime-bindings.ts`). A socket frame is untrusted input
 * that arrived over the network from another client's broadcast: typing it as a domain
 * object at the boundary is the same mistake as trusting a request body.
 *
 * ## `onGap` is the part that makes this correct
 *
 * A reconnecting socket silently loses everything sent while it was down. Supabase Realtime
 * re-subscribes and resumes delivery with no indication that anything was missed, so a
 * client that treats the socket as the source of truth ends up with a conversation that is
 * permanently missing a block of messages and looks fine.
 *
 * The transport therefore reports a **gap** whenever a channel re-subscribes after having
 * been subscribed before. The caller's obligation on a gap is to refetch from its own
 * watermark (`seq`) rather than to assume continuity — see
 * [ADR-0022](../../../docs/adr/0022-ordering-and-sync.md). This callback existing is what
 * turns "we hope we got everything" into a bounded, testable recovery.
 *
 * ## Why status and gap are separate callbacks
 *
 * Status drives UI (a "Reconnecting…" banner). A gap drives a refetch. Collapsing them means
 * either the banner flickers on every benign status transition or the refetch fires on
 * transitions that did not lose anything — and the refetch is the expensive one.
 */

/** JSON, as a type. Broadcast payloads are serialised, so a `Date` or a function is a bug. */
export type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

/**
 * The lifecycle of one channel, not of the underlying socket.
 *
 * `reconnecting` is distinct from `connecting` because only the former implies a gap: a
 * channel that has never been subscribed has no history to have missed.
 */
export type RealtimeStatus = 'connecting' | 'subscribed' | 'reconnecting' | 'closed' | 'error';

export interface RealtimeEvent {
  readonly channel: string;
  readonly event: string;
  /** Untrusted. Validate before use — see the module docblock. */
  readonly payload: unknown;
}

export interface RealtimePresenceParticipant {
  /**
   * The presence key the participant joined with. Supabase collapses duplicate keys, so a
   * user on three devices appears once if all three use their user id — which is what
   * "is this person online" wants, and is why the key is the caller's choice.
   */
  readonly key: string;
  readonly state: JsonObject;
}

export interface RealtimePresenceOptions {
  readonly key: string;
  readonly initialState: JsonObject;
  /**
   * The **complete** participant set, every time. Not a diff: reconstructing a set from
   * join/leave diffs across a reconnect is where presence lists go wrong, and Supabase
   * already re-sends the full state on sync.
   */
  onSync(participants: readonly RealtimePresenceParticipant[]): void;
}

export interface RealtimeSubscribeOptions {
  /**
   * The channel name. Opaque here; the caller owns the naming scheme so that two callers
   * cannot accidentally agree on a name without agreeing on a payload.
   */
  readonly channel: string;
  onEvent(event: RealtimeEvent): void;
  onStatus?(status: RealtimeStatus): void;
  /** Fired after a re-subscribe. The caller must resync from its watermark. */
  onGap?(): void;
  /** Omit to subscribe without joining presence — presence has a real per-channel cost. */
  readonly presence?: RealtimePresenceOptions;
}

export interface RealtimeSubscription {
  readonly channel: string;

  /**
   * Send to every other subscriber of this channel. Never persisted, never authoritative.
   *
   * This is the only sanctioned path for typing indicators: §40 of the spec forbids
   * rate-limiting typing through database writes, and a broadcast is not a write at all.
   */
  broadcast(event: string, payload: JsonObject): Promise<void>;

  /** Replaces this connection's presence state. No-op if the channel joined without presence. */
  updatePresence(state: JsonObject): Promise<void>;

  /** Idempotent. Unsubscribing twice is not an error. */
  unsubscribe(): Promise<void>;
}

export interface RealtimeTransport {
  subscribe(options: RealtimeSubscribeOptions): RealtimeSubscription;

  /**
   * Hands the socket the current access token.
   *
   * Realtime authorizes channels against the JWT at join time and does **not** re-read it
   * from the auth client on refresh. A socket left holding an expired token keeps its
   * existing channels but fails to authorize new ones, which presents as "the app works
   * until you open a new conversation an hour later". Must be called on sign-in, on every
   * token refresh, and with `null` on sign-out.
   */
  setAuth(accessToken: string | null): Promise<void>;

  /** Closes the socket and every channel on it. Sign-out only. */
  disconnect(): Promise<void>;
}
