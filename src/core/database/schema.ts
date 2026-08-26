/**
 * The database's TypeScript shape, and the helper aliases every repository reads it through.
 *
 * This is the seam that makes the notification type registry drift-proof: `Enums<'…'>` resolves
 * to the Postgres enum's members, so a type that exists in the database and not in the registry
 * — or the reverse — is a compile error rather than a runtime surprise
 * ([ADR-0011](../../../docs/adr/0011-repository-pattern.md)).
 *
 * ## `Database` is empty, and that is accurate
 *
 * `npm run db:types` writes `types.generated.ts` from the live local schema, and from the moment
 * the first migration exists this file's `Database` becomes one re-export line pointing at it:
 *
 * ```ts
 * export type { Database, Json } from './types.generated';
 * ```
 *
 * Right now there are no migrations, so there is no schema to generate from — and the local
 * stack needs Docker, which cannot start on this machine (WSL 2 kernel absent; `wsl --update`
 * fixes it and needs an elevated prompt). Declaring the empty schema by hand here rather than
 * pre-filling `types.generated.ts` is the deliberate choice: nothing in the tree should claim to
 * be generated output when it was typed by hand, and a reader who sees that filename must be
 * able to trust it.
 *
 * The consequence is a useful gate rather than a gap. With no tables declared, `TableName` is
 * `never`, so `client.from('notifications')` does not compile. Stage 2's migrations therefore
 * *have* to be generated from before any repository can be written — which is the correct order
 * anyway, and is now enforced by the type checker instead of by remembering.
 *
 * The helper aliases below are hand-written and permanent. They are the vocabulary features use
 * (`Tables<'notifications'>`, not `Database['public']['Tables']['notifications']['Row']`), and
 * they do not change when `Database` starts coming from the generator.
 */

/** Postgres `json`/`jsonb`, as the generator spells it. */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/**
 * Shaped like generated output rather than minimally, so the swap above is genuinely one line.
 *
 * `__InternalSupabase.PostgrestVersion` is what `supabase-js` reads to decide which response
 * typing to apply; it is part of the generated envelope, not something this codebase invents.
 */
export interface Database {
  readonly __InternalSupabase: {
    readonly PostgrestVersion: '13.0.5';
  };
  readonly public: {
    readonly Tables: Record<
      never,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      }
    >;
    readonly Views: Record<never, { Row: Record<string, unknown>; Relationships: [] }>;
    /**
     * Hand-declared for the RPCs the messaging surface calls until `db:types` regenerates the
     * whole file from migrations. `Returns: Json` on `messaging_inbox_list` matches the SQL
     * return type; the repository narrows it to its own DTO shape at the call site rather than
     * spreading `Json` through the feature.
     */
    readonly Functions: {
      readonly messaging_inbox_list: {
        Args: Record<string, never>;
        Returns: Json;
      };
      readonly messaging_seed_demo: {
        Args: Record<string, never>;
        Returns: void;
      };
      readonly messaging_mark_read: {
        Args: { cid: string; up_to_seq: number };
        Returns: void;
      };
      readonly messaging_thread_page: {
        Args: { cid: string; before_seq: number | null; limit_in: number };
        Returns: Json;
      };
      readonly messaging_send_message: {
        Args: {
          cid: string;
          body_in: string;
          reply_to_seq_in: number | null;
          attachment_in?: Json | null;
          kind_in?: 'text' | 'attachment' | 'voice';
        };
        Returns: Json;
      };
      readonly messaging_toggle_reaction: {
        Args: { msg_id: string; emoji_in: string };
        Returns: void;
      };
    };
    readonly Enums: Record<never, string>;
    readonly CompositeTypes: Record<never, Record<string, unknown>>;
  };
}

/** The one schema this client is bound to. `client.ts` fixes `db.schema` to match. */
export type PublicSchema = Database['public'];

export type TableName = keyof PublicSchema['Tables'];
export type ViewName = keyof PublicSchema['Views'];
export type EnumName = keyof PublicSchema['Enums'];
export type FunctionName = keyof PublicSchema['Functions'];

/**
 * A row as it comes back from a `select`.
 *
 * `Row` and not `Insert`: a repository's mapper takes the shape the database returns, and
 * conflating the two is how a nullable-on-read/required-on-write column becomes a runtime
 * `undefined` (ADR-0011 §3).
 */
export type Tables<Name extends TableName> = PublicSchema['Tables'][Name]['Row'];

export type TablesInsert<Name extends TableName> = PublicSchema['Tables'][Name]['Insert'];
export type TablesUpdate<Name extends TableName> = PublicSchema['Tables'][Name]['Update'];
export type Views<Name extends ViewName> = PublicSchema['Views'][Name]['Row'];

/**
 * A Postgres enum's members as a string union.
 *
 * The load-bearing helper. `NOTIFICATION_EVENTS` is declared
 * `satisfies Record<Enums<'notification_type'>, …>`, which is what turns "the registry and the
 * database agree" from a convention into a build failure.
 */
export type Enums<Name extends EnumName> = PublicSchema['Enums'][Name];

export type FunctionArgs<Name extends FunctionName> = PublicSchema['Functions'][Name]['Args'];
export type FunctionReturns<Name extends FunctionName> = PublicSchema['Functions'][Name]['Returns'];
