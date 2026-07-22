import Foundation

struct RoomScanRecord: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let createdAt: Date
    let fileStem: String
    let wallCount: Int
    let doorCount: Int
    let windowCount: Int
    let objectCount: Int
    let floorAreaSquareMeters: Double?
    let netWallAreaSquareMeters: Double?
    let referenceImageFileName: String?

    var displayName: String {
        "공간 스캔 \(createdAt.formatted(date: .abbreviated, time: .shortened))"
    }

    var formattedFloorArea: String {
        guard let floorAreaSquareMeters else { return "면적 계산 전" }
        return floorAreaSquareMeters.formatted(.number.precision(.fractionLength(1))) + "㎡"
    }
}
