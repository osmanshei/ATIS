import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export function staffPhotoValidationError(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return "";
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Staff photo must be a JPG, PNG or WebP image.";
  }
  if (file.size > MAX_BYTES) {
    return "Staff photo must not exceed 5 MB.";
  }
  return "";
}

export async function uploadStaffPhoto(
  supabase: SupabaseClient,
  args: { schoolId: string; staffId: string; file: File },
) {
  const error = staffPhotoValidationError(args.file);
  if (error) throw new Error(error);

  const path = args.schoolId + "/" + args.staffId + "/profile";
  const bytes = new Uint8Array(await args.file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("staff-photos")
    .upload(path, bytes, {
      contentType: args.file.type,
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from("staff")
    .update({ profile_photo_url: path })
    .eq("id", args.staffId)
    .eq("school_id", args.schoolId);

  if (updateError) throw updateError;
  return path;
}

export async function removeStaffPhoto(
  supabase: SupabaseClient,
  args: { schoolId: string; staffId: string; photoPath?: string | null },
) {
  if (args.photoPath) {
    const { error: removeError } = await supabase.storage
      .from("staff-photos")
      .remove([args.photoPath]);
    if (removeError) throw removeError;
  }

  const { error } = await supabase
    .from("staff")
    .update({ profile_photo_url: null })
    .eq("id", args.staffId)
    .eq("school_id", args.schoolId);

  if (error) throw error;
}

export async function signedStaffPhotoUrl(
  supabase: SupabaseClient,
  photoPath: string | null | undefined,
  expiresIn = 3600,
) {
  if (!photoPath) return "";
  const { data, error } = await supabase.storage
    .from("staff-photos")
    .createSignedUrl(photoPath, expiresIn);
  return error ? "" : data.signedUrl;
}
