import Foundation
import RoomPlan

@MainActor
final class LocalRoomScanStore: ObservableObject {
    @Published private(set) var records: [RoomScanRecord] = []
    @Published private(set) var lastErrorMessage: String?

    private let fileManager: FileManager
    private let scansDirectory: URL
    private let indexURL: URL

    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager

        let applicationSupport = fileManager.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        )[0]
        let rootDirectory = applicationSupport
            .appending(path: "InpickLiDARLab", directoryHint: .isDirectory)
        self.scansDirectory = rootDirectory
            .appending(path: "Scans", directoryHint: .isDirectory)
        self.indexURL = rootDirectory.appending(path: "scan-index.json")

        do {
            try fileManager.createDirectory(
                at: scansDirectory,
                withIntermediateDirectories: true
            )
            records = try Self.loadIndex(from: indexURL)
                .sorted { $0.createdAt > $1.createdAt }
        } catch {
            lastErrorMessage = "저장된 스캔 목록을 불러오지 못했습니다: \(error.localizedDescription)"
        }
    }

    func save(_ room: CapturedRoom) async throws -> RoomScanRecord {
        let id = UUID()
        let createdAt = Date()
        let fileStem = id.uuidString.lowercased()
        let metrics = RoomMetrics.calculate(from: room)
        let record = RoomScanRecord(
            id: id,
            createdAt: createdAt,
            fileStem: fileStem,
            wallCount: room.walls.count,
            doorCount: room.doors.count,
            windowCount: room.windows.count,
            objectCount: room.objects.count,
            floorAreaSquareMeters: metrics.floorAreaSquareMeters,
            netWallAreaSquareMeters: metrics.netWallAreaSquareMeters,
            referenceImageFileName: "\(fileStem)-reference.png"
        )
        let directory = scansDirectory

        try await Task.detached(priority: .userInitiated) {
            let manager = FileManager.default
            try manager.createDirectory(at: directory, withIntermediateDirectories: true)

            let jsonURL = directory.appending(path: "\(fileStem).json")
            let modelURL = directory.appending(path: "\(fileStem).usdz")

            do {
                let encoder = JSONEncoder()
                encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
                encoder.dateEncodingStrategy = .iso8601
                let data = try encoder.encode(room)
                try data.write(to: jsonURL, options: .atomic)
                try room.export(to: modelURL, exportOptions: .mesh)
            } catch {
                try? manager.removeItem(at: jsonURL)
                try? manager.removeItem(at: modelURL)
                throw error
            }
        }.value

        do {
            let referenceData = try await RoomReferenceImageRenderer.pngData(
                for: room,
                modelURL: modelURL(for: record)
            )
            try referenceData.write(to: referenceImageURL(for: record), options: .atomic)
        } catch {
            try? fileManager.removeItem(at: jsonURL(for: record))
            try? fileManager.removeItem(at: modelURL(for: record))
            try? fileManager.removeItem(at: referenceImageURL(for: record))
            throw error
        }

        records.insert(record, at: 0)
        try persistIndex()
        lastErrorMessage = nil
        return record
    }

    func delete(_ record: RoomScanRecord) {
        do {
            let jsonURL = jsonURL(for: record)
            let modelURL = modelURL(for: record)
            let referenceURL = referenceImageURL(for: record)

            if fileManager.fileExists(atPath: jsonURL.path()) {
                try fileManager.removeItem(at: jsonURL)
            }
            if fileManager.fileExists(atPath: modelURL.path()) {
                try fileManager.removeItem(at: modelURL)
            }
            if fileManager.fileExists(atPath: referenceURL.path()) {
                try fileManager.removeItem(at: referenceURL)
            }

            records.removeAll { $0.id == record.id }
            try persistIndex()
            lastErrorMessage = nil
        } catch {
            lastErrorMessage = "스캔을 삭제하지 못했습니다: \(error.localizedDescription)"
        }
    }

    func jsonURL(for record: RoomScanRecord) -> URL {
        scansDirectory.appending(path: "\(record.fileStem).json")
    }

    func modelURL(for record: RoomScanRecord) -> URL {
        scansDirectory.appending(path: "\(record.fileStem).usdz")
    }

    func referenceImageURL(for record: RoomScanRecord) -> URL {
        scansDirectory.appending(
            path: record.referenceImageFileName ?? "\(record.fileStem)-reference.png"
        )
    }

    private func persistIndex() throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(records)
        try data.write(to: indexURL, options: .atomic)
    }

    private static func loadIndex(from url: URL) throws -> [RoomScanRecord] {
        guard FileManager.default.fileExists(atPath: url.path()) else {
            return []
        }

        let data = try Data(contentsOf: url)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([RoomScanRecord].self, from: data)
    }
}
