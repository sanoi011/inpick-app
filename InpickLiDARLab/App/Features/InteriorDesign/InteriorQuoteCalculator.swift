import Foundation

enum InteriorQuoteCalculator {
    // Prototype rates only. Replace with a versioned supplier rate card before production.
    private struct RateCard {
        let flooringPerSquareMeter: Int
        let wallFinishPerSquareMeter: Int
        let ceilingPerSquareMeter: Int
        let furniturePerSquareMeter: Int
        let lightingAndElectricalPerSquareMeter: Int
        let designAndInstallationPerSquareMeter: Int
    }

    static func calculate(
        floorAreaSquareMeters: Double,
        netWallAreaSquareMeters: Double,
        grade: InteriorFinishGrade
    ) -> InteriorQuote {
        let floorArea = max(0, floorAreaSquareMeters)
        let wallArea = max(0, netWallAreaSquareMeters)
        let rates = rateCard(for: grade)

        let lineItems = [
            line("바닥 마감", area: floorArea, rate: rates.flooringPerSquareMeter),
            line("벽 마감", area: wallArea, rate: rates.wallFinishPerSquareMeter),
            line("천장 마감", area: floorArea, rate: rates.ceilingPerSquareMeter),
            line("가구·수납 예산", area: floorArea, rate: rates.furniturePerSquareMeter),
            line("조명·전기", area: floorArea, rate: rates.lightingAndElectricalPerSquareMeter),
            line("설계·시공 관리", area: floorArea, rate: rates.designAndInstallationPerSquareMeter)
        ]

        let subtotal = lineItems.reduce(0) { $0 + $1.amountKRW }
        let contingency = roundedToTenThousand(Double(subtotal) * 0.1)
        let total = subtotal + contingency

        return InteriorQuote(
            floorAreaSquareMeters: floorArea,
            netWallAreaSquareMeters: wallArea,
            lineItems: lineItems,
            subtotalKRW: subtotal,
            contingencyKRW: contingency,
            estimatedTotalKRW: total,
            lowerBoundKRW: roundedToTenThousand(Double(total) * 0.85),
            upperBoundKRW: roundedToTenThousand(Double(total) * 1.15)
        )
    }

    private static func rateCard(for grade: InteriorFinishGrade) -> RateCard {
        switch grade {
        case .standard:
            RateCard(
                flooringPerSquareMeter: 150_000,
                wallFinishPerSquareMeter: 70_000,
                ceilingPerSquareMeter: 55_000,
                furniturePerSquareMeter: 350_000,
                lightingAndElectricalPerSquareMeter: 90_000,
                designAndInstallationPerSquareMeter: 180_000
            )
        case .premium:
            RateCard(
                flooringPerSquareMeter: 260_000,
                wallFinishPerSquareMeter: 130_000,
                ceilingPerSquareMeter: 95_000,
                furniturePerSquareMeter: 650_000,
                lightingAndElectricalPerSquareMeter: 160_000,
                designAndInstallationPerSquareMeter: 290_000
            )
        }
    }

    private static func line(_ title: String, area: Double, rate: Int) -> InteriorQuoteLineItem {
        InteriorQuoteLineItem(
            id: UUID(),
            title: title,
            basis: String(format: "%.1f㎡ × %@원", area, rate.formatted()),
            amountKRW: roundedToTenThousand(area * Double(rate))
        )
    }

    private static func roundedToTenThousand(_ amount: Double) -> Int {
        Int((amount / 10_000).rounded()) * 10_000
    }
}
