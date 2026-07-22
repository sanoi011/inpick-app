import QuickLookThumbnailing
import RoomPlan
import SwiftUI
import UIKit
import simd

enum RoomReferenceImageRenderer {
    @MainActor
    static func pngData(
        for room: CapturedRoom,
        modelURL: URL
    ) async throws -> Data {
        let thumbnail = try? await modelThumbnail(at: modelURL)
        let image = renderReference(
            room: room,
            modelThumbnail: thumbnail
        )

        guard let data = image.pngData() else {
            throw ReferenceRenderError.pngEncodingFailed
        }
        return data
    }

    @MainActor
    private static func modelThumbnail(at url: URL) async throws -> UIImage {
        let request = QLThumbnailGenerator.Request(
            fileAt: url,
            size: CGSize(width: 1_536, height: 1_024),
            scale: 1,
            representationTypes: .thumbnail
        )
        request.iconMode = false

        return try await withCheckedThrowingContinuation { continuation in
            QLThumbnailGenerator.shared.generateBestRepresentation(for: request) { representation, error in
                if let representation {
                    continuation.resume(returning: representation.uiImage)
                } else {
                    continuation.resume(throwing: error ?? ReferenceRenderError.thumbnailUnavailable)
                }
            }
        }
    }

    @MainActor
    private static func renderReference(
        room: CapturedRoom,
        modelThumbnail: UIImage?
    ) -> UIImage {
        let size = CGSize(width: 1_536, height: 1_024)
        let renderer = UIGraphicsImageRenderer(size: size)

        return renderer.image { context in
            UIColor(red: 0.965, green: 0.965, blue: 0.985, alpha: 1).setFill()
            context.fill(CGRect(origin: .zero, size: size))

            let modelFrame = CGRect(x: 64, y: 64, width: 1_408, height: 896)
            if let modelThumbnail {
                modelThumbnail.draw(in: aspectFitRect(for: modelThumbnail.size, inside: modelFrame))
            } else {
                drawFloorPlan(room: room, in: modelFrame, context: context.cgContext)
            }
        }
    }

    private static func aspectFitRect(for imageSize: CGSize, inside frame: CGRect) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0 else { return frame }
        let scale = min(frame.width / imageSize.width, frame.height / imageSize.height)
        let size = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
        return CGRect(
            x: frame.midX - size.width / 2,
            y: frame.midY - size.height / 2,
            width: size.width,
            height: size.height
        )
    }

    @MainActor
    private static func drawFloorPlan(
        room: CapturedRoom,
        in frame: CGRect,
        context: CGContext
    ) {
        let polygons = room.floors.compactMap { floor -> [CGPoint]? in
            let points = floor.polygonCorners.map { corner -> CGPoint in
                let world = simd_mul(
                    floor.transform,
                    SIMD4<Float>(corner.x, corner.y, corner.z, 1)
                )
                return CGPoint(x: Double(world.x), y: Double(world.z))
            }
            return points.count >= 3 ? points : nil
        }

        guard !polygons.isEmpty else {
            let fallback = CGRect(x: frame.midX - 420, y: frame.midY - 250, width: 840, height: 500)
            context.setFillColor(UIColor.systemIndigo.withAlphaComponent(0.18).cgColor)
            context.setStrokeColor(UIColor.systemIndigo.cgColor)
            context.setLineWidth(10)
            context.addPath(
                CGPath(
                    roundedRect: fallback,
                    cornerWidth: 30,
                    cornerHeight: 30,
                    transform: nil
                )
            )
            context.drawPath(using: .fillStroke)
            return
        }

        let allPoints = polygons.flatMap { $0 }
        let minX = allPoints.map { $0.x }.min() ?? 0
        let maxX = allPoints.map { $0.x }.max() ?? 1
        let minY = allPoints.map { $0.y }.min() ?? 0
        let maxY = allPoints.map { $0.y }.max() ?? 1
        let width = max(maxX - minX, 0.1)
        let height = max(maxY - minY, 0.1)
        let scale = min((frame.width - 160) / width, (frame.height - 160) / height)

        func mapped(_ point: CGPoint) -> CGPoint {
            CGPoint(
                x: frame.midX + (point.x - (minX + maxX) / 2) * scale,
                y: frame.midY - (point.y - (minY + maxY) / 2) * scale
            )
        }

        context.setFillColor(UIColor.systemIndigo.withAlphaComponent(0.16).cgColor)
        context.setStrokeColor(UIColor.systemIndigo.cgColor)
        context.setLineWidth(10)
        context.setLineJoin(.round)

        for polygon in polygons {
            guard let first = polygon.first else { continue }
            context.beginPath()
            context.move(to: mapped(first))
            polygon.dropFirst().forEach { context.addLine(to: mapped($0)) }
            context.closePath()
            context.drawPath(using: .fillStroke)
        }
    }
}

private enum ReferenceRenderError: LocalizedError {
    case thumbnailUnavailable
    case pngEncodingFailed

    var errorDescription: String? {
        switch self {
        case .thumbnailUnavailable:
            "USDZ 미리보기를 만들 수 없습니다."
        case .pngEncodingFailed:
            "참조 이미지를 PNG로 저장할 수 없습니다."
        }
    }
}
