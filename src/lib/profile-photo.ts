export const PHOTO_BUCKET = "profile-photos";
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export function validProfilePhoto(file: { size: number; type: string }) {
  return file.size > 0 && file.size <= PHOTO_MAX_BYTES && PHOTO_TYPES.includes(file.type);
}
