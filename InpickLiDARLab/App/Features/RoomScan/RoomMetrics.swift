import Foundation
import RoomPlan
import simd

struct RoomMetrics: Codable, Hashable, Sendable {
    let floorAreaSquareMeters: Double
    let netWallAreaSquareMeters: Double

    static func calculate(from room: CapturedRoom) -> RoomMetrics {
        let floorArea = room.floors.reduce(0) { result, floor in
            result + surfaceArea(floor)
        }

        let grossWallArea = room.walls.reduce(0) { result, wall in
            result + surfaceArea(wall)
        }
        let openingArea = (room.doors + room.windows + room.openings).reduce(0) { result, opening in
            result + surfaceArea(opening)
        }

        return RoomMetrics(
            floorAreaSquareMeters: max(0, floorArea),
            netWallAreaSquareMeters: max(0, grossWallArea - openingArea)
        )
    }

    private static func surfaceArea(_ surface: CapturedRoom.Surface) -> Double {
        let corners = surface.polygonCorners
        guard corners.count >= 3 else {
            let dimensions = [
                abs(Double(surface.dimensions.x)),
                abs(Double(surface.dimensions.y)),
                abs(Double(surface.dimensions.z))
            ].sorted(by: >)
            return dimensions[0] * dimensions[1]
        }

        // RoomPlan expresses a surface polygon in its local plane. Selecting the
        // largest projected shoelace area keeps this valid for floors and walls.
        let xy = polygonArea(corners.map { (Double($0.x), Double($0.y)) })
        let xz = polygonArea(corners.map { (Double($0.x), Double($0.z)) })
        let yz = polygonArea(corners.map { (Double($0.y), Double($0.z)) })
        return max(xy, xz, yz)
    }

    private static func polygonArea(_ points: [(Double, Double)]) -> Double {
        guard points.count >= 3 else { return 0 }

        let twiceArea = points.indices.reduce(0.0) { result, index in
            let nextIndex = (index + 1) % points.count
            return result
                + points[index].0 * points[nextIndex].1
                - points[nextIndex].0 * points[index].1
        }
        return abs(twiceArea) / 2
    }
}
