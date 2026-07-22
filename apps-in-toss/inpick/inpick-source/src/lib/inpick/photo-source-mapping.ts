export interface PhotoSourceImage {
  dataUrl?: string;
  url?: string;
  base64?: string;
  mediaType?: "image/jpeg" | "image/png" | "image/webp";
}

export function mapPhotoSourcesToRooms(input: {
  roomKeys: string[];
  sourceImages: PhotoSourceImage[];
}): Record<string, PhotoSourceImage | undefined> {
  const result: Record<string, PhotoSourceImage | undefined> = {};
  const fallback = input.sourceImages.length === 1 ? input.sourceImages[0] : undefined;
  input.roomKeys.forEach((roomKey, index) => {
    result[roomKey] = input.sourceImages[index] ?? fallback;
  });
  return result;
}
