import SwiftUI

struct DesignStudioView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var scanStore: LocalRoomScanStore
    @EnvironmentObject private var designStore: LocalInteriorDesignStore

    @AppStorage("designServiceURL") private var designServiceURL = "http://127.0.0.1:8787"

    let scan: RoomScanRecord

    @State private var roomType: InteriorRoomType = .livingRoom
    @State private var style: InteriorStyle = .modern
    @State private var finishGrade: InteriorFinishGrade = .standard
    @State private var colorPalette = "따뜻한 화이트와 내추럴 우드"
    @State private var notes = ""
    @State private var isGenerating = false
    @State private var errorMessage: String?
    @State private var isShowingSettings = false

    private var floorArea: Double { scan.floorAreaSquareMeters ?? 0 }
    private var wallArea: Double { scan.netWallAreaSquareMeters ?? 0 }

    private var brief: InteriorDesignBrief {
        InteriorDesignBrief(
            roomType: roomType,
            style: style,
            finishGrade: finishGrade,
            colorPalette: colorPalette,
            notes: notes
        )
    }

    private var quote: InteriorQuote {
        InteriorQuoteCalculator.calculate(
            floorAreaSquareMeters: floorArea,
            netWallAreaSquareMeters: wallArea,
            grade: finishGrade
        )
    }

    private var latestDesign: InteriorDesignRecord? {
        designStore.latestDesign(for: scan.id)
    }

    var body: some View {
        ZStack {
            InpickTheme.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    referenceCard
                    requirementsCard
                    quoteCard
                    generatedDesignCard
                    generateButton
                }
                .padding(20)
                .padding(.bottom, 24)
            }
        }
        .navigationTitle("AI 공간 디자인")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(InpickTheme.canvas, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("닫기") { dismiss() }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    isShowingSettings = true
                } label: {
                    Image(systemName: "server.rack")
                }
                .accessibilityLabel("디자인 서버 설정")
            }
        }
        .sheet(isPresented: $isShowingSettings) {
            ServiceSettingsView()
        }
        .alert("생성 실패", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "알 수 없는 오류")
        }
    }

    private var referenceCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionTitle("LiDAR 공간 데이터", systemImage: "sensor.tag.radiowaves.forward.fill")

            LocalFileImage(url: scanStore.referenceImageURL(for: scan))
                .frame(height: 220)
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .overlay { RoundedRectangle(cornerRadius: 20).stroke(InpickTheme.hairline) }

            HStack(spacing: 10) {
                metricPill(title: "바닥 면적", value: areaText(floorArea))
                metricPill(title: "순 벽면", value: areaText(wallArea))
            }

            Text("이 치수와 3D 공간 미리보기가 이미지 생성 프롬프트의 공간 제약으로 함께 전달됩니다.")
                .font(InpickTheme.bodyFont(size: 13))
                .foregroundStyle(InpickTheme.mutedInk)
                .lineSpacing(3)
        }
        .inpickCard()
    }

    private var requirementsCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            sectionTitle("인테리어 요구", systemImage: "slider.horizontal.3")

            labeledPicker("공간", selection: $roomType, values: InteriorRoomType.allCases)
            labeledPicker("스타일", selection: $style, values: InteriorStyle.allCases)

            VStack(alignment: .leading, spacing: 8) {
                Text("마감 등급")
                    .font(InpickTheme.bodyFont(size: 14, weight: .semibold))
                Picker("마감 등급", selection: $finishGrade) {
                    ForEach(InteriorFinishGrade.allCases) { grade in
                        Text(grade.title).tag(grade)
                    }
                }
                .pickerStyle(.segmented)
            }
            .padding(14)
            .background(InpickTheme.canvas, in: RoundedRectangle(cornerRadius: 16))

            VStack(alignment: .leading, spacing: 8) {
                Text("색상·소재")
                    .font(InpickTheme.bodyFont(size: 14, weight: .semibold))
                TextField("예: 밝은 오크와 아이보리", text: $colorPalette)
                    .font(InpickTheme.bodyFont())
                    .padding(14)
                    .background(InpickTheme.canvas, in: RoundedRectangle(cornerRadius: 14))
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("추가 요청")
                    .font(InpickTheme.bodyFont(size: 14, weight: .semibold))
                TextField("유지할 가구, 수납 요구, 분위기 등", text: $notes, axis: .vertical)
                    .lineLimit(3...6)
                    .font(InpickTheme.bodyFont())
                    .padding(14)
                    .background(InpickTheme.canvas, in: RoundedRectangle(cornerRadius: 14))
            }
        }
        .inpickCard()
    }

    private var quoteCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionTitle("예상 견적", systemImage: "wonsign.circle.fill")

            HStack(alignment: .firstTextBaseline) {
                Text(quote.estimatedTotalKRW.formatted(.currency(code: "KRW")))
                    .font(InpickTheme.displayFont(size: 26))
                    .foregroundStyle(InpickTheme.ink)
                Spacer()
                Text("±15% 범위")
                    .font(InpickTheme.bodyFont(size: 12, weight: .semibold))
                    .foregroundStyle(InpickTheme.accent)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(InpickTheme.accentSoft, in: Capsule())
            }

            Text("\(quote.lowerBoundKRW.formatted(.currency(code: "KRW"))) ~ \(quote.upperBoundKRW.formatted(.currency(code: "KRW")))")
                .font(InpickTheme.bodyFont(size: 14, weight: .medium))
                .foregroundStyle(InpickTheme.mutedInk)

            Divider()

            ForEach(quote.lineItems) { item in
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.title).font(InpickTheme.bodyFont(size: 14, weight: .semibold))
                        Text(item.basis).font(InpickTheme.bodyFont(size: 12)).foregroundStyle(InpickTheme.mutedInk)
                    }
                    Spacer()
                    Text(item.amountKRW.formatted(.currency(code: "KRW")))
                        .font(InpickTheme.bodyFont(size: 14, weight: .medium).monospacedDigit())
                }
            }

            Text("시범 단가표에 따른 참고 견적입니다. 현장 상태, 철거, 설비, 자재 선택과 파트너 실측에 따라 최종 계약 금액이 달라집니다.")
                .font(InpickTheme.bodyFont(size: 12))
                .foregroundStyle(InpickTheme.warning)
                .lineSpacing(3)
        }
        .inpickCard()
    }

    @ViewBuilder
    private var generatedDesignCard: some View {
        if let latestDesign {
            VStack(alignment: .leading, spacing: 14) {
                sectionTitle("AI 디자인 결과", systemImage: "sparkles")
                LocalFileImage(url: designStore.imageURL(for: latestDesign))
                    .aspectRatio(3 / 2, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 20))

                HStack {
                    Text(latestDesign.createdAt.formatted(date: .abbreviated, time: .shortened))
                        .font(InpickTheme.bodyFont(size: 12))
                        .foregroundStyle(InpickTheme.mutedInk)
                    Spacer()
                    ShareLink(item: designStore.imageURL(for: latestDesign)) {
                        Label("공유", systemImage: "square.and.arrow.up")
                    }
                    .font(InpickTheme.bodyFont(size: 14, weight: .semibold))
                }
            }
            .inpickCard()
        }
    }

    private var generateButton: some View {
        VStack(spacing: 9) {
            Button {
                generateDesign()
            } label: {
                if isGenerating {
                    HStack {
                        ProgressView().tint(.white)
                        Text("GPT Image 2 생성 중")
                    }
                } else {
                    Label(
                        latestDesign == nil ? "AI 디자인 생성" : "새 디자인 다시 생성",
                        systemImage: "wand.and.stars"
                    )
                }
            }
            .buttonStyle(InpickPrimaryButtonStyle())
            .disabled(isGenerating || floorArea <= 0)

            Text("이미지 생성 API 사용량에 따른 비용이 발생할 수 있습니다.")
                .font(InpickTheme.bodyFont(size: 11))
                .foregroundStyle(InpickTheme.mutedInk)
        }
    }

    private func sectionTitle(_ title: String, systemImage: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(InpickTheme.accent)
                .frame(width: 32, height: 32)
                .background(InpickTheme.accentSoft, in: Circle())
            Text(title)
                .font(InpickTheme.titleFont(size: 18))
                .foregroundStyle(InpickTheme.ink)
        }
    }

    private func metricPill(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(InpickTheme.bodyFont(size: 12)).foregroundStyle(InpickTheme.mutedInk)
            Text(value).font(InpickTheme.titleFont(size: 17).monospacedDigit()).foregroundStyle(InpickTheme.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(InpickTheme.accentSoft, in: RoundedRectangle(cornerRadius: 15))
    }

    private func labeledPicker<Value: Identifiable & Hashable>(
        _ title: String,
        selection: Binding<Value>,
        values: [Value]
    ) -> some View where Value: RawRepresentable, Value.RawValue == String {
        HStack(spacing: 12) {
            Text(title).font(InpickTheme.bodyFont(size: 14, weight: .semibold))
            Spacer()
            Picker(title, selection: selection) {
                ForEach(values) { value in
                    Text(displayTitle(for: value)).tag(value)
                }
            }
            .pickerStyle(.menu)
            .tint(InpickTheme.accent)
        }
        .padding(14)
        .background(InpickTheme.canvas, in: RoundedRectangle(cornerRadius: 16))
    }

    private func displayTitle<Value>(for value: Value) -> String {
        if let value = value as? InteriorStyle { return value.title }
        if let value = value as? InteriorRoomType { return value.title }
        return String(describing: value)
    }

    private func areaText(_ area: Double) -> String {
        area.formatted(.number.precision(.fractionLength(1))) + "㎡"
    }

    private func generateDesign() {
        guard let serviceURL = URL(string: designServiceURL),
              let scheme = serviceURL.scheme,
              ["http", "https"].contains(scheme) else {
            errorMessage = InteriorDesignAPIError.invalidServiceURL.localizedDescription
            return
        }

        let referenceURL = scanStore.referenceImageURL(for: scan)
        guard let referenceData = try? Data(contentsOf: referenceURL) else {
            errorMessage = "LiDAR 참조 이미지를 읽을 수 없습니다. 공간을 다시 스캔해주세요."
            return
        }

        let request = GenerateInteriorDesignRequest(
            scan: .init(
                scanID: scan.id,
                floorAreaSquareMeters: floorArea,
                netWallAreaSquareMeters: wallArea,
                wallCount: scan.wallCount,
                doorCount: scan.doorCount,
                windowCount: scan.windowCount,
                objectCount: scan.objectCount
            ),
            brief: brief,
            quote: quote,
            referenceImageBase64: referenceData.base64EncodedString(),
            referenceImageMimeType: "image/png"
        )

        isGenerating = true
        errorMessage = nil
        Task {
            defer { isGenerating = false }
            do {
                let response = try await InteriorDesignAPIClient().generate(
                    request: request,
                    serviceURL: serviceURL
                )
                _ = try designStore.save(
                    response: response,
                    scan: scan,
                    brief: brief,
                    quote: quote
                )
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

private struct LocalFileImage: View {
    let url: URL

    var body: some View {
        Group {
            if let image = UIImage(contentsOfFile: url.path()) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                ZStack {
                    InpickTheme.canvas
                    Image(systemName: "photo.badge.exclamationmark")
                        .font(.largeTitle)
                        .foregroundStyle(InpickTheme.mutedInk)
                }
            }
        }
        .clipped()
    }
}
