import Foundation

@MainActor
final class LocalInteriorDesignStore: ObservableObject {
    @Published private(set) var records: [InteriorDesignRecord] = []
    @Published private(set) var lastErrorMessage: String?

    private let fileManager: FileManager
    private let designsDirectory: URL
    private let indexURL: URL

    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
        let rootDirectory = fileManager.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        )[0].appending(path: "InpickLiDARLab", directoryHint: .isDirectory)
        self.designsDirectory = rootDirectory.appending(path: "Designs", directoryHint: .isDirectory)
        self.indexURL = rootDirectory.appending(path: "design-index.json")

        do {
            try fileManager.createDirectory(at: designsDirectory, withIntermediateDirectories: true)
            records = try Self.loadIndex(from: indexURL).sorted { $0.createdAt > $1.createdAt }
        } catch {
            records = []
        }
    }

    func save(
        response: GenerateInteriorDesignResponse,
        scan: RoomScanRecord,
        brief: InteriorDesignBrief,
        quote: InteriorQuote
    ) throws -> InteriorDesignRecord {
        guard let imageData = Data(base64Encoded: response.imageBase64) else {
            throw InteriorDesignStoreError.invalidImageData
        }

        let id = UUID()
        let fileExtension = response.mimeType == "image/jpeg" ? "jpg" : "png"
        let fileName = "\(id.uuidString.lowercased()).\(fileExtension)"
        try imageData.write(
            to: designsDirectory.appending(path: fileName),
            options: .atomic
        )

        let record = InteriorDesignRecord(
            id: id,
            scanID: scan.id,
            createdAt: Date(),
            brief: brief,
            quote: quote,
            generatedImageFileName: fileName,
            revisedPrompt: response.revisedPrompt
        )
        records.insert(record, at: 0)
        do {
            try persistIndex()
            lastErrorMessage = nil
            return record
        } catch {
            records.removeAll { $0.id == record.id }
            try? fileManager.removeItem(at: designsDirectory.appending(path: fileName))
            lastErrorMessage = "AI 디자인을 저장하지 못했습니다: \(error.localizedDescription)"
            throw error
        }
    }

    func designs(for scanID: UUID) -> [InteriorDesignRecord] {
        records.filter { $0.scanID == scanID }
    }

    func latestDesign(for scanID: UUID) -> InteriorDesignRecord? {
        designs(for: scanID).first
    }

    func imageURL(for record: InteriorDesignRecord) -> URL {
        designsDirectory.appending(path: record.generatedImageFileName)
    }

    @discardableResult
    func deleteDesigns(for scanID: UUID) -> Bool {
        let matchingRecords = designs(for: scanID)
        let remainingRecords = records.filter { $0.scanID != scanID }

        do {
            // Persist the relationship removal first. A failed image deletion can
            // only leave an unreferenced cache file, never a broken design record.
            try persistIndex(remainingRecords)
            records = remainingRecords

            for record in matchingRecords {
                let imageURL = imageURL(for: record)
                if fileManager.fileExists(atPath: imageURL.path()) {
                    try? fileManager.removeItem(at: imageURL)
                }
            }
            lastErrorMessage = nil
            return true
        } catch {
            lastErrorMessage = "AI 디자인을 삭제하지 못했습니다: \(error.localizedDescription)"
            return false
        }
    }

    private func persistIndex(_ recordsToPersist: [InteriorDesignRecord]? = nil) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        try encoder.encode(recordsToPersist ?? records).write(to: indexURL, options: .atomic)
    }

    private static func loadIndex(from url: URL) throws -> [InteriorDesignRecord] {
        guard FileManager.default.fileExists(atPath: url.path()) else { return [] }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([InteriorDesignRecord].self, from: Data(contentsOf: url))
    }
}

private enum InteriorDesignStoreError: LocalizedError {
    case invalidImageData

    var errorDescription: String? {
        "이미지 생성 결과를 읽을 수 없습니다."
    }
}
