import Foundation

enum InteriorStyle: String, Codable, CaseIterable, Identifiable, Sendable {
    case modern
    case minimal
    case warmNatural
    case hotel
    case industrial

    var id: String { rawValue }

    var title: String {
        switch self {
        case .modern: "모던"
        case .minimal: "미니멀"
        case .warmNatural: "내추럴"
        case .hotel: "호텔"
        case .industrial: "인더스트리얼"
        }
    }

    var promptValue: String {
        switch self {
        case .modern: "contemporary modern interior"
        case .minimal: "calm minimal interior"
        case .warmNatural: "warm natural interior with wood and soft textures"
        case .hotel: "refined luxury hotel interior"
        case .industrial: "polished industrial interior"
        }
    }
}

enum InteriorRoomType: String, Codable, CaseIterable, Identifiable, Sendable {
    case livingRoom
    case bedroom
    case kitchen
    case office
    case studio

    var id: String { rawValue }

    var title: String {
        switch self {
        case .livingRoom: "거실"
        case .bedroom: "침실"
        case .kitchen: "주방"
        case .office: "오피스"
        case .studio: "원룸"
        }
    }

    var promptValue: String {
        switch self {
        case .livingRoom: "living room"
        case .bedroom: "bedroom"
        case .kitchen: "kitchen and dining area"
        case .office: "small office"
        case .studio: "compact studio apartment"
        }
    }
}

enum InteriorFinishGrade: String, Codable, CaseIterable, Identifiable, Sendable {
    case standard
    case premium

    var id: String { rawValue }
    var title: String { self == .standard ? "스탠다드" : "프리미엄" }
}

struct InteriorDesignBrief: Codable, Hashable, Sendable {
    let roomType: InteriorRoomType
    let style: InteriorStyle
    let finishGrade: InteriorFinishGrade
    let colorPalette: String
    let notes: String
}

struct InteriorQuoteLineItem: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let title: String
    let basis: String
    let amountKRW: Int
}

struct InteriorQuote: Codable, Hashable, Sendable {
    let floorAreaSquareMeters: Double
    let netWallAreaSquareMeters: Double
    let lineItems: [InteriorQuoteLineItem]
    let subtotalKRW: Int
    let contingencyKRW: Int
    let estimatedTotalKRW: Int
    let lowerBoundKRW: Int
    let upperBoundKRW: Int
}

struct InteriorDesignRecord: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let scanID: UUID
    let createdAt: Date
    let brief: InteriorDesignBrief
    let quote: InteriorQuote
    let generatedImageFileName: String
    let revisedPrompt: String?
}

struct GenerateInteriorDesignRequest: Codable, Sendable {
    struct ScanContext: Codable, Sendable {
        let scanID: UUID
        let floorAreaSquareMeters: Double
        let netWallAreaSquareMeters: Double
        let wallCount: Int
        let doorCount: Int
        let windowCount: Int
        let objectCount: Int
    }

    let scan: ScanContext
    let brief: InteriorDesignBrief
    let quote: InteriorQuote
    let referenceImageBase64: String
    let referenceImageMimeType: String
}

struct GenerateInteriorDesignResponse: Codable, Sendable {
    let imageBase64: String
    let mimeType: String
    let revisedPrompt: String?
    let model: String
}
