import SwiftUI
import UIKit

struct AppRootView: View {
    @EnvironmentObject private var scanStore: LocalRoomScanStore
    @EnvironmentObject private var designStore: LocalInteriorDesignStore
    @Environment(\.openURL) private var openURL

    @State private var isShowingScanner = false
    @State private var isRequestingCamera = false
    @State private var isShowingCameraAlert = false
    @State private var selectedDesignScan: RoomScanRecord?
    @State private var pendingDesignScan: RoomScanRecord?
    @State private var isShowingServiceSettings = false

    private var isLiDARSupported: Bool {
        RoomScanAvailability.isLiDARSupported
    }

    var body: some View {
        NavigationStack {
            ZStack {
                InpickTheme.canvas.ignoresSafeArea()

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 28) {
                        header
                        introduction
                        scanHero
                        savedScansSection
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 12)
                    .padding(.bottom, 40)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .tint(InpickTheme.accent)
        .preferredColorScheme(.light)
        .fullScreenCover(isPresented: $isShowingScanner, onDismiss: openPendingDesign) {
            RoomScannerView(store: scanStore) { scan in
                pendingDesignScan = scan
            }
        }
        .fullScreenCover(item: $selectedDesignScan) { scan in
            NavigationStack {
                DesignStudioView(scan: scan)
            }
        }
        .sheet(isPresented: $isShowingServiceSettings) {
            ServiceSettingsView()
        }
        .alert("카메라 접근이 필요합니다", isPresented: $isShowingCameraAlert) {
            Button("취소", role: .cancel) {}
            Button("설정 열기") {
                guard let settingsURL = URL(string: UIApplication.openSettingsURLString) else { return }
                openURL(settingsURL)
            }
        } message: {
            Text("설정에서 Inpick의 카메라 접근을 허용한 뒤 다시 시도해주세요.")
        }
    }

    private var header: some View {
        HStack {
            Text("INPICK")
                .font(.system(size: 18, weight: .black, design: .rounded))
                .tracking(2.2)
                .foregroundStyle(InpickTheme.ink)

            Spacer()

            Button {
                isShowingServiceSettings = true
            } label: {
                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: 16, weight: .semibold))
                    .frame(width: 42, height: 42)
                    .foregroundStyle(InpickTheme.ink)
                    .background(InpickTheme.surface, in: Circle())
                    .overlay { Circle().stroke(InpickTheme.hairline) }
            }
            .accessibilityLabel("AI 디자인 서버 설정")
        }
    }

    private var introduction: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("내 공간을 새롭게\n디자인해보세요")
                .font(InpickTheme.displayFont(size: 32))
                .foregroundStyle(InpickTheme.ink)
                .lineSpacing(2)

            Text("LiDAR로 공간을 측정하고, AI 디자인과 예상 견적을 한 번에 만들어드려요.")
                .font(InpickTheme.bodyFont(size: 16))
                .foregroundStyle(InpickTheme.mutedInk)
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var scanHero: some View {
        VStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 28)
                    .fill(InpickTheme.heroGradient)

                Circle()
                    .fill(.white.opacity(0.10))
                    .frame(width: 210, height: 210)
                    .offset(x: 120, y: -92)

                Circle()
                    .fill(.white.opacity(0.08))
                    .frame(width: 150, height: 150)
                    .offset(x: -145, y: 102)

                VStack(spacing: 14) {
                    Image(systemName: "viewfinder")
                        .font(.system(size: 45, weight: .medium))
                        .frame(width: 94, height: 94)
                        .background(.white.opacity(0.16), in: Circle())

                    VStack(spacing: 5) {
                        Text("LiDAR 공간 스캔")
                            .font(InpickTheme.titleFont(size: 22))
                        Text("벽·문·창문과 면적을 정확하게 기록해요")
                            .font(InpickTheme.bodyFont(size: 14, weight: .medium))
                            .opacity(0.82)
                    }
                }
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)
            }
            .frame(height: 250)
            .clipShape(RoundedRectangle(cornerRadius: 28))

            availabilityStatus

            Button {
                beginScan()
            } label: {
                if isRequestingCamera {
                    ProgressView().tint(.white)
                } else {
                    Label("공간 스캔 시작", systemImage: "camera.viewfinder")
                }
            }
            .buttonStyle(InpickPrimaryButtonStyle())
            .disabled(!isLiDARSupported || isRequestingCamera)
        }
    }

    private var availabilityStatus: some View {
        HStack(spacing: 9) {
            Circle()
                .fill(isLiDARSupported ? InpickTheme.success : InpickTheme.warning)
                .frame(width: 8, height: 8)
            Text(isLiDARSupported ? "이 기기에서 LiDAR 스캔을 사용할 수 있어요" : "LiDAR가 탑재된 iPhone 또는 iPad가 필요해요")
                .font(InpickTheme.bodyFont(size: 13, weight: .medium))
                .foregroundStyle(InpickTheme.mutedInk)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 4)
    }

    @ViewBuilder
    private var savedScansSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            InpickSectionTitle(title: "내 공간", detail: "\(scanStore.records.count)개")

            if let errorMessage = scanStore.lastErrorMessage {
                errorLabel(errorMessage)
            }
            if let errorMessage = designStore.lastErrorMessage {
                errorLabel(errorMessage)
            }

            if scanStore.records.isEmpty {
                emptyState
            } else {
                ForEach(scanStore.records) { record in
                    ScanRecordRow(
                        record: record,
                        designCount: designStore.designs(for: record.id).count,
                        jsonURL: scanStore.jsonURL(for: record),
                        modelURL: scanStore.modelURL(for: record),
                        onOpenDesign: { selectedDesignScan = record },
                        onDelete: {
                            if designStore.deleteDesigns(for: record.id) {
                                scanStore.delete(record)
                            }
                        }
                    )
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "square.stack.3d.up")
                .font(.system(size: 30, weight: .light))
                .foregroundStyle(InpickTheme.accent)
                .frame(width: 64, height: 64)
                .background(InpickTheme.accentSoft, in: Circle())
            Text("아직 저장된 공간이 없어요")
                .font(InpickTheme.titleFont(size: 17))
                .foregroundStyle(InpickTheme.ink)
            Text("첫 스캔을 완료하면\nAI 디자인과 견적을 시작할 수 있어요.")
                .font(InpickTheme.bodyFont(size: 14))
                .foregroundStyle(InpickTheme.mutedInk)
                .multilineTextAlignment(.center)
                .lineSpacing(3)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 30)
        .inpickCard(padding: 0)
    }

    private func errorLabel(_ message: String) -> some View {
        Label(message, systemImage: "exclamationmark.triangle.fill")
            .font(InpickTheme.bodyFont(size: 13, weight: .medium))
            .foregroundStyle(InpickTheme.warning)
    }

    private func beginScan() {
        guard isLiDARSupported else { return }
        isRequestingCamera = true

        Task {
            let isAuthorized = await RoomScanAvailability.requestCameraAccess()
            isRequestingCamera = false
            if isAuthorized {
                isShowingScanner = true
            } else {
                isShowingCameraAlert = true
            }
        }
    }

    private func openPendingDesign() {
        guard let pendingDesignScan else { return }
        self.pendingDesignScan = nil
        Task { @MainActor in
            selectedDesignScan = pendingDesignScan
        }
    }
}

private struct ScanRecordRow: View {
    let record: RoomScanRecord
    let designCount: Int
    let jsonURL: URL
    let modelURL: URL
    let onOpenDesign: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(InpickTheme.heroGradient)
                    Image(systemName: "cube.transparent")
                        .font(.system(size: 23, weight: .medium))
                        .foregroundStyle(.white)
                }
                .frame(width: 58, height: 58)

                VStack(alignment: .leading, spacing: 5) {
                    Text(record.displayName)
                        .font(InpickTheme.titleFont(size: 16))
                        .foregroundStyle(InpickTheme.ink)
                        .lineLimit(1)
                    Text("\(record.formattedFloorArea)  ·  AI 디자인 \(designCount)개")
                        .font(InpickTheme.bodyFont(size: 13, weight: .semibold))
                        .foregroundStyle(InpickTheme.accent)
                    Text("벽 \(record.wallCount)  문 \(record.doorCount)  창 \(record.windowCount)  가구 \(record.objectCount)")
                        .font(InpickTheme.bodyFont(size: 12))
                        .foregroundStyle(InpickTheme.mutedInk)
                        .lineLimit(1)
                }

                Spacer(minLength: 4)

                Menu {
                    ShareLink(item: modelURL) { Label("USDZ 공유", systemImage: "cube") }
                    ShareLink(item: jsonURL) { Label("JSON 공유", systemImage: "curlybraces") }
                    Divider()
                    Button(role: .destructive, action: onDelete) { Label("삭제", systemImage: "trash") }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 16, weight: .semibold))
                        .frame(width: 38, height: 38)
                        .background(InpickTheme.canvas, in: Circle())
                }
                .foregroundStyle(InpickTheme.ink)
            }

            Button(action: onOpenDesign) {
                HStack {
                    Label("디자인·견적 보기", systemImage: "sparkles")
                    Spacer()
                    Image(systemName: "chevron.right")
                }
                .padding(.horizontal, 16)
            }
            .buttonStyle(InpickSecondaryButtonStyle())
            .disabled((record.floorAreaSquareMeters ?? 0) <= 0)

            if record.floorAreaSquareMeters == nil {
                Text("면적 계산을 위해 이 공간을 다시 스캔해주세요.")
                    .font(InpickTheme.bodyFont(size: 12))
                    .foregroundStyle(InpickTheme.warning)
            }
        }
        .inpickCard()
    }
}
