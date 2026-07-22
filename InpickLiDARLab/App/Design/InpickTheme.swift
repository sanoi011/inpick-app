import SwiftUI
import UIKit

enum InpickTheme {
    static let accent = Color(red: 0.16, green: 0.36, blue: 0.98)
    static let accentEnd = Color(red: 0.12, green: 0.64, blue: 0.98)
    static let accentSoft = Color(red: 0.93, green: 0.96, blue: 1.00)
    static let canvas = Color(red: 0.975, green: 0.98, blue: 0.99)
    static let surface = Color.white
    static let ink = Color(red: 0.07, green: 0.09, blue: 0.14)
    static let mutedInk = Color(red: 0.42, green: 0.45, blue: 0.52)
    static let hairline = Color(red: 0.90, green: 0.92, blue: 0.95)
    static let success = Color(red: 0.12, green: 0.65, blue: 0.42)
    static let warning = Color(red: 0.94, green: 0.49, blue: 0.12)
    static let cornerRadius: CGFloat = 22

    static let heroGradient = LinearGradient(
        colors: [accent, accentEnd],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static func displayFont(size: CGFloat) -> Font {
        .system(size: size, weight: .bold, design: .rounded)
    }

    static func titleFont(size: CGFloat = 20) -> Font {
        .system(size: size, weight: .semibold, design: .rounded)
    }

    static func bodyFont(size: CGFloat = 15, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }
}

struct InpickCardModifier: ViewModifier {
    let padding: CGFloat

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(InpickTheme.surface, in: RoundedRectangle(cornerRadius: InpickTheme.cornerRadius))
            .overlay {
                RoundedRectangle(cornerRadius: InpickTheme.cornerRadius)
                    .stroke(InpickTheme.hairline, lineWidth: 1)
            }
    }
}

extension View {
    func inpickCard(padding: CGFloat = 20) -> some View {
        modifier(InpickCardModifier(padding: padding))
    }
}

struct InpickPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(InpickTheme.bodyFont(size: 16, weight: .semibold))
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .foregroundStyle(.white)
            .background {
                RoundedRectangle(cornerRadius: 16)
                    .fill(isEnabled ? InpickTheme.heroGradient : LinearGradient(colors: [.gray.opacity(0.42)], startPoint: .leading, endPoint: .trailing))
            }
            .opacity(configuration.isPressed ? 0.82 : 1)
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

struct InpickSecondaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(InpickTheme.bodyFont(size: 15, weight: .semibold))
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .foregroundStyle(isEnabled ? InpickTheme.accent : InpickTheme.mutedInk)
            .background(InpickTheme.accentSoft, in: RoundedRectangle(cornerRadius: 15))
            .opacity(configuration.isPressed ? 0.72 : 1)
    }
}

struct InpickSectionTitle: View {
    let title: String
    var detail: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(InpickTheme.titleFont())
                .foregroundStyle(InpickTheme.ink)
            Spacer()
            if let detail {
                Text(detail)
                    .font(InpickTheme.bodyFont(size: 13, weight: .medium))
                    .foregroundStyle(InpickTheme.mutedInk)
            }
        }
    }
}
