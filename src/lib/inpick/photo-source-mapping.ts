export interface PhotoSourceImage {
  dataUrl?: string;
  url?: string;
  base64?: string;
  mediaType?: "image/jpeg" | "image/png" | "image/webp";
  targetRoomKey?: string;
}

export function mapPhotoSourcesToRooms(input: {
  roomKeys: string[];
  sourceImages: PhotoSourceImage[];
}): Record<string, PhotoSourceImage | undefined> {
  const result: Record<string, PhotoSourceImage | undefined> = {};
  for (const source of input.sourceImages) {
    if (source.targetRoomKey && input.roomKeys.includes(source.targetRoomKey)) {
      result[source.targetRoomKey] = source;
    }
  }
  const unassigned = input.sourceImages.filter((source) => !source.targetRoomKey);
  let unassignedIndex = 0;
  input.roomKeys.forEach((roomKey) => {
    // 한 장의 실제 공간 사진을 다른 실에 재사용하면 거실 구조가 욕실·침실에도
    // 강제되는 문제가 생긴다. 사진은 순서대로 한 실에만 귀속하고, 사진이 없는
    // 실은 room-specific text generation 경로가 새 이미지를 만든다.
    if (!result[roomKey]) {
      result[roomKey] = unassigned[unassignedIndex];
      unassignedIndex += 1;
    }
  });
  return result;
}
