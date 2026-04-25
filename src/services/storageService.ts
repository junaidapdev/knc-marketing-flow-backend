import { randomUUID } from 'node:crypto';
import { ERRORS } from '../constants/errors';
import { INTERNAL } from '../constants/httpStatus';
import { db } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';

export const SHOP_ACTIVITY_BUCKET = 'shop-activity-photos';
export const RECEIPTS_BUCKET = 'receipts';

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const READ_URL_EXPIRES_SECONDS = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;

function storageError(message: string | undefined): HttpError {
  return new HttpError(
    INTERNAL,
    ERRORS.STORAGE_UPLOAD_FAILED.code,
    ERRORS.STORAGE_UPLOAD_FAILED.message,
    {
      cause: message,
    },
  );
}

export interface SignedUploadUrl {
  uploadUrl: string;
  path: string;
  /** Signed read URL that can be polled by the client once the upload is done. */
  publicUrl: string;
}

/**
 * Generate a pre-signed upload URL for a fresh object path in the given
 * bucket plus a matching signed read URL the client can persist back via
 * PATCH once the upload completes.
 */
export async function createSignedUpload(bucket: string, prefix: string): Promise<SignedUploadUrl> {
  const path = `${prefix}/${randomUUID()}`;

  const upload = await db.storage.from(bucket).createSignedUploadUrl(path);
  if (upload.error || !upload.data) throw storageError(upload.error?.message);

  const read = await db.storage.from(bucket).createSignedUrl(path, READ_URL_EXPIRES_SECONDS);
  if (read.error || !read.data?.signedUrl) throw storageError(read.error?.message);

  return {
    uploadUrl: upload.data.signedUrl,
    path,
    publicUrl: read.data.signedUrl,
  };
}
