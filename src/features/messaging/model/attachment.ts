/**
 * Attachments, as the client sees them after a row has been mapped.
 *
 * ## `storagePath`, never a URL
 *
 * The mapped object carries the **path inside the bucket**, not a signed URL. A signed URL has
 * an expiry, and a domain object that contains one is a domain object that goes stale in the
 * query cache — the bug being an image that renders on open and 400s twenty minutes later.
 * Signing happens at render time in `useAttachmentUrl`, which can re-sign, and the cache holds
 * the path, which cannot expire.
 *
 * ## Why the dimensions and duration are stored rather than probed
 *
 * `width`/`height` let the bubble reserve the right box **before** the image loads, which is
 * the difference between a list that settles and a list that reflows every row as thumbnails
 * arrive — and reflow in a virtualized inverted list is what produces the scroll jump that
 * makes chat feel broken. Same for `durationMs`: the voice-note bubble's width is a function
 * of length, and probing the audio file to find it would mean downloading it.
 */
import type { AttachmentKind } from './enums';
import type { AttachmentId, MessageId } from './ids';

export interface Attachment {
  readonly id: AttachmentId;
  readonly messageId: MessageId;
  readonly kind: AttachmentKind;

  /** Path within the `message-attachments` bucket: `{conversationId}/{messageId}/{id}`. */
  readonly storagePath: string;

  /**
   * The type the **server** determined, from magic bytes — not the one the client claimed.
   * §42: never trust the client's MIME. The client's value is recorded in the audit log and
   * discarded here, so nothing downstream can read it by accident.
   */
  readonly mimeType: string;
  readonly byteSize: number;

  /**
   * The original name, for documents. Sanitised server-side: path separators and control
   * characters are stripped, because this string reaches a download filename and a filename
   * containing `../` is a directory-traversal attempt with a UI.
   */
  readonly fileName: string;

  /** Images and video only. Null elsewhere — see the docblock on reflow. */
  readonly width: number | null;
  readonly height: number | null;

  /** Audio and video only. */
  readonly durationMs: number | null;

  /**
   * A coarse amplitude envelope for voice notes: 0–1 samples, bounded to a fixed count
   * server-side so the bubble's waveform is a constant-cost render regardless of length.
   * Null for everything else.
   */
  readonly waveform: readonly number[] | null;

  /** Bucket path of a generated thumbnail, for images and video. */
  readonly thumbnailPath: string | null;
}
