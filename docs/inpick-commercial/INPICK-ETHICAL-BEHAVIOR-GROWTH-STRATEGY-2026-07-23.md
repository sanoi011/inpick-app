# InPick 윤리적 행동설계·콘텐츠·성장 전략

기준일: 2026-07-23
대상: 웹 · iOS · Android · 앱인토스 공통 `Step 1 요구사항 → Step 2 실별 디자인·실제 SKU → Step 3 상세견적 → Decision Packet → 동일 조건 입찰`
제외: InPick Living·Unreal 전부

## 0. 경영 결론

InPick이 최적화해야 할 것은 클릭이나 이미지 생성 횟수가 아니라 **사용자가 정보의 한계까지 이해한 상태에서 비교 가능한 의사결정 자료를 완성하는 것**이다.

권장 North Star:

`Informed Decision Packet Completion`

완료 조건:

1. 실별 최종 디자인을 확인했다.
2. AI 이미지가 시공 결과나 SKU의 정확한 픽셀 재현을 보증하지 않음을 확인했다.
3. SKU의 모델번호·규격·출처·검증일을 확인했다.
4. 견적의 수량 산식·가격 기준일·포함/제외·현장 확인 항목을 확인했다.
5. 공유할 개인정보 범위를 직접 선택했다.
6. 하나의 불변 버전을 확정했다.

단기 우선순위:

1. **P0: 신뢰·이해·자기효능감 기반** — Step 1 스캐폴딩, 사진 프라이버시, 실제 진행률, 근거 우선 견적.
2. **P0: 측정 기반** — 웹·iOS·Android·앱인토스 공통 이벤트와 오인·후회·분쟁 guardrail.
3. **P1: 선택 품질** — 설명 가능한 SKU 3개, 전체 보기, 견적 델타, 직접 편집·되돌리기.
4. **P1: Decision Packet** — 정본 버전, 공유 범위, 미확정 항목.
5. **P2: 사회적 증거·추천** — 검증된 실제 표본과 광고 관계가 확보된 뒤에만 시작.

## 1. 해석 원칙

- 아래 학술 결과는 InPick에서의 효과를 보장하지 않는다. 모든 제품 적용은 검증할 행동가설이다.
- 논문에 없는 효과 크기나 예상 전환율을 만들지 않는다.
- 호텔·관광·패션·일반 전자상거래 연구를 고비용 인테리어에 그대로 일반화하지 않는다.
- 선택과부하, 사회적 규범, 처리유창성은 맥락 의존적이다.
- 전환율이 올라도 확정가 오인, SKU 동일성 오인, 개인정보 후회, 추가금 불만, 원치 않는 연락이 악화되면 실패다.
- 가짜 희소성·진행률·리뷰, 숨은 가격, 결과물 인질화, 추천 위장은 실험 대상이 아니라 금지 사항이다.

## 2. 미국 대학 연구 근거와 InPick 가설

### U1. 다차원 전자상거래 신뢰

- McKnight, D. H., Choudhury, V., & Kacmar, C. (2002). *Developing and Validating Trust Measures for e-Commerce: An Integrative Typology*. Information Systems Research.
- 대학: Michigan State University, University of Cincinnati, Florida State University
- DOI: https://doi.org/10.1287/isre.13.3.334.81
- 확인된 의미: 제도 기반 신뢰, 구조적 보장, 판매자의 능력·선의·정직성, 신뢰 의도는 구분되는 구성개념이다.
- InPick 가설: 단일 “안심 견적” 배지보다 산식·검증일·책임주체·개인정보 처리·업체 검증범위를 분리해 증명하면 견적 이해와 상담 품질이 개선된다.
- 금지: 유료 노출 업체를 인증 업체처럼 표시하거나 검증 범위를 숨기기.

### U2. 자기효능감

- Bandura, A. (1977). *Self-efficacy: Toward a Unifying Theory of Behavioral Change*. Psychological Review.
- 대학: Stanford University
- DOI: https://doi.org/10.1037/0033-295X.84.2.191
- Stanford: https://longevity.stanford.edu/self-efficacy-toward-a-unifying-theory-of-behavior-change/
- PubMed: https://pubmed.ncbi.nlm.nih.gov/847061/
- 확인된 의미: 자신의 수행 능력에 대한 판단은 행동 시작·노력·지속성과 관련된다.
- InPick 가설: 예시, 즉시 확인, 되돌리기, `모르겠음/현장 확인 필요`를 제공하면 Step 1 입력 품질과 사진 제출 성공률이 개선된다.
- 금지: 사용자의 불안을 키워 상담을 유일한 탈출구로 제시하기.

### U3. 상황에 가까운 진실한 사회적 규범

- Goldstein, N. J., Cialdini, R. B., & Griskevicius, V. (2008). *A Room with a Viewpoint: Using Social Norms to Motivate Environmental Conservation in Hotels*. Journal of Consumer Research.
- 대학 연결: Arizona State University, University of Minnesota
- DOI: https://doi.org/10.1086/586910
- 확인된 의미: 호텔 현장에서는 일반 호소보다 실제 행동을 알리는 기술적 규범, 특히 가까운 상황의 규범이 더 관련성 있게 작동했다.
- InPick 가설: 전국 “인기”보다 동일 주거형태·평형·공사유형의 검증 사례를 모수·기간과 함께 제시하는 편이 유용하다.
- 한계: 호텔 수건 재사용 결과가 인테리어 의사결정 효과를 보장하지 않는다.
- 금지: 표본 미달 수치, 가짜 인기, 광고 노출을 인기 순위로 위장.

### U4. 실제 진행의 인정

- Nunes, J. C., & Drèze, X. (2006). *The Endowed Progress Effect: How Artificial Advancement Increases Effort*. Journal of Consumer Research.
- 대학: University of Southern California, University of Pennsylvania
- DOI: https://doi.org/10.1086/500480
- 확인된 의미: 일부 진행된 목표로 인식될 때 목표 지속성이 높아질 수 있다.
- InPick 가설: 주소·방 목록·유효 사진처럼 실제 완료된 입력을 다음 단계의 진척으로 인정하면 재개와 완료가 늘어난다.
- 금지: 가입·마케팅 동의를 견적 진행률로 계산하거나 뒤에서 필수 단계를 추가하기.

### U5. 선택과부하

- Iyengar, S. S., & Lepper, M. R. (2000). *When Choice Is Demotivating: Can One Desire Too Much of a Good Thing?* Journal of Personality and Social Psychology.
- 대학 연결: Columbia University, Stanford University
- DOI: https://doi.org/10.1037/0022-3514.79.6.995
- PubMed: https://pubmed.ncbi.nlm.nih.gov/11138768/
- 확인된 의미: 큰 선택 집합은 관심을 끌 수 있지만 제한된 집합보다 실제 선택·동기·만족에 불리할 수 있다.
- InPick 가설: Step 1 제약에 맞는 설명 가능한 SKU 3개와 `전체 보기`가 전체 그리드보다 선택 품질을 높인다.
- 한계: 효과는 사용자의 전문성·선호 명확성·옵션 구조에 따라 달라진다.
- 금지: 마진 높은 상품만 shortlist에 넣고 전체 보기나 추천 이유를 숨기기.

### U6. 처리유창성

- Reber, R., Winkielman, P., & Schwarz, N. (1998). *Effects of Perceptual Fluency on Affective Judgments*. Psychological Science.
- 대학 연결: University of Michigan
- DOI: https://doi.org/10.1111/1467-9280.00008
- 확인된 의미: 지각적 유창성은 대상에 대한 정서 평가에 영향을 줄 수 있다.
- InPick 가설: 공종·수량·단가·불확실성을 일관된 용어와 단위로 제시하면 견적 이해가 빨라진다.
- 핵심 한계: 읽기 쉬움은 진실의 증거가 아니다. 성공지표는 미적 선호보다 이해도 정답률이어야 한다.

### U7. 심리적 소유감과 직접 조작

- Peck, J., & Shu, S. B. (2009). *The Effect of Mere Touch on Perceived Ownership*. Journal of Consumer Research.
- 대학: University of Wisconsin–Madison, UCLA
- DOI: https://doi.org/10.1086/598614
- 확인된 의미: 물리적 접촉 또는 접촉 상상은 지각된 소유감에 영향을 줄 수 있다.
- InPick 가설: 결과 갤러리보다 사용자가 자신의 이미지에서 SKU·마감재를 직접 바꾸고 되돌리는 UX가 디자인 저장·확정에 도움이 된다.
- 한계: 디지털 image-edit 적용은 직접 재현이 아니라 유추다.
- 금지: 사용자가 편집한 노력을 매몰비용으로 이용해 결제·업체 종속을 유도하기.

### U8. 계획오류와 작업분해

- Kruger, J., & Evans, M. (2004). *If You Don’t Want to Be Late, Enumerate: Unpacking Reduces the Planning Fallacy*. Journal of Experimental Social Psychology.
- 대학: University of Illinois Urbana-Champaign
- DOI: https://doi.org/10.1016/j.jesp.2003.11.001
- 확인된 의미: 복잡한 과업을 구성 작업으로 풀어 생각하면 완료시간 과소추정을 줄일 수 있다.
- InPick 가설: 총액·총기간 대신 철거→보양→설비→전기→마감→검수와 선행조건을 보여주면 일정·비용 기대가 더 현실적으로 조정된다.
- 한계: 비용 오차 감소는 InPick에서 별도 검증할 확장가설이다.

### U9. Drip pricing

- Santana, S., Dallas, S. K., & Morwitz, V. G. (2020). *Consumer Reactions to Drip Pricing*. Marketing Science.
- 대학 연결: Bentley University, New York University, Duke University/Columbia University
- DOI: https://doi.org/10.1287/mksc.2019.1207
- 확인된 의미: 필수·선택 비용을 뒤늦게 공개하는 가격 구조는 선택과 만족에 영향을 준다.
- InPick 가설: 철거·폐기·운반·보양·부가세·조건부 비용을 첫 견적부터 구분하면 초기 클릭이 낮아져도 후기 이탈·분쟁이 줄어든다.
- 금지: 의도적으로 낮은 미끼 가격을 보여주는 실험 자체.

## 3. 한국 대학 연구 근거와 현지화

### K1. 온라인 리뷰 품질·수량과 관여도

- Park, D.-H., Lee, J., & Han, I. (2007). *The Effect of On-Line Consumer Reviews on Consumer Purchasing Intention: The Moderating Role of Involvement*. International Journal of Electronic Commerce.
- 소속: KAIST Business School/MIS
- DOI: https://doi.org/10.2753/JEC1086-4415110405
- 의미: 리뷰 품질과 수량의 영향은 관여도에 따라 다르게 나타났다.
- InPick 적용: 고관여인 견적·업체 단계에서는 리뷰 수보다 동일 평형·예산·공종, 실제 견적차, 검증사진, 추가금·지연·A/S 정보를 우선한다.

### K2. 부정 리뷰와 정보처리

- Lee, J., Park, D.-H., & Han, I. (2008). *The effect of negative online consumer reviews on product attitude: An information processing view*. Electronic Commerce Research and Applications.
- 연구 연결: KAIST 연구진
- DOI: https://doi.org/10.1016/j.elerap.2007.05.004
- InPick 적용: 부정 리뷰를 숨기지 않고 일정 지연·추가비용·마감·소통·A/S로 구조화하며 업체 답변과 해결 여부를 함께 보여준다.
- 주의: 리뷰 부재를 만족 증거로 해석하지 않는다.

### K3. 지각된 위험과 브랜드 신뢰성

- Jun, S.-H. (2020). *The Effects of Perceived Risk, Brand Credibility and Past Experience on Purchase Intention in the Airbnb Context*. Sustainability.
- 소속: 계명대학교 관광경영학과
- DOI: https://doi.org/10.3390/su12125212
- 확인된 의미: 한국 표본에서 심리적 위험은 이용자와 비이용자의 이용의도에 부정적으로 관련됐고, 과거 경험은 위험의 영향을 조절했다. 브랜드 신뢰성은 이용자·비이용자 모두에게 중요한 요인이었다.
- InPick 적용: 업체 사업자·면허·보험·하자보수·실제 시공이력의 검증범위와 날짜를 공개하고, AI 이미지·SKU·예상견적·확정견적 상태를 분리한다.
- 한계: Airbnb 맥락을 인테리어에 직접 일반화하지 않는다. 일정 지연·추가금·하자·집 사진 노출 위험을 InPick에서 별도로 측정한다.
- 금지: 위험을 과장해 즉시 계약을 압박하거나 플랫폼 브랜드가 시공 결과를 보장한다고 표현하기.

### K4. 모바일 가독성과 상황적 방해

- Kim, J.-Y., Choi, Y., Xia, M., & Kim, J. (2022). *Mobile-Friendly Content Design for MOOCs: Challenges, Requirements, and Design Opportunities*. CHI Conference on Human Factors in Computing Systems.
- 소속: 저자 전원 KAIST
- DOI: https://doi.org/10.1145/3491102.3502054
- 확인된 의미: 작은 화면의 가독성과 모바일 사용 중 상황적 방해를 조사하고 적응형·사용자 조절형 시각 디자인 기회를 제시했다.
- InPick 적용: Step 3를 요약→항목별 펼치기로 구성하고, 글자 확대·고대비·고정 합계·변경 강조·단위 일관성을 제공한다. Step 2 이미지 핀에는 겹치지 않는 목록 보기 대안을 둔다.
- 한계: MOOC 콘텐츠 연구가 인테리어 견적의 인지부하를 직접 측정한 것은 아니다. 이동 중 이해와 저장 후 큰 화면/PDF 재검토를 별도로 검증한다.

### K5. 한국 온라인 거래의 신뢰

- Kim, M.-J., Chung, N., & Lee, C.-K. (2011). *The effect of perceived trust on electronic commerce: Shopping online for tourism products and services in South Korea*. Tourism Management.
- 소속: 경희대학교
- DOI: https://doi.org/10.1016/j.tourman.2010.01.011
- InPick 적용: 업체 검증, AI 책임 경계, 견적 산출 책임, 사진 저장·공유·삭제를 각각 설명한다.
- 한계: 관광보다 인테리어의 금액·기간·주거 사생활 위험이 크므로 추가금·공기·하자·사진유출 문항을 별도 측정한다.

### K6. 위험지각과 온라인 상인 신뢰

- Hong, I. B., & Cha, H. S. (2013). *The mediating role of consumer trust in an online merchant in predicting purchase intention*. International Journal of Information Management.
- 소속: 중앙대학교
- DOI: https://doi.org/10.1016/j.ijinfomgt.2013.08.007
- InPick 적용: 플랫폼 검증과 업체 자기주장을 분리하고 계약·보증·분쟁 절차를 연락처 공유 전에 설명한다.
- 금지: 플랫폼 로고 자체를 모든 시공위험의 보증처럼 사용하기.

### K7. 채널별 가격 차이와 공정성

- Choi, S., & Mattila, A. S. (2009). *Perceived Fairness of Price Differences Across Channels: The Moderating Role of Price Frame and Norm Perceptions*. Journal of Marketing Theory and Practice.
- 소속: Sunmee Choi—연세대학교 경영대학, Anna S. Mattila—Pennsylvania State University
- DOI: https://doi.org/10.2753/MTP1069-6679170103
- 확인된 의미: 동일가격과 채널별 차등가격의 공정성 평가는 가격 프레임과 소비자가 차등가격을 정상적 관행으로 인식하는지에 따라 달라질 수 있다.
- InPick 적용: 자재비·시공비·철거·운반·폐기·부가세·옵션을 동일 분류체계로 표시하고, 온라인 예상가와 업체 실견적의 차이를 현장조건·수량·등급·지역으로 설명한다. 모든 변경은 사유와 승인 이력을 보존한다.
- 금지: “원래 현장마다 다르다”는 관행만으로 가격 차이를 정당화하거나, 할인 전 기준가격을 부풀리고 부가세·철거·폐기비를 뒤에서 추가하기.

### K8. 한국 온라인 쇼핑과 자기효능감

- Son, H., & Lee, J. (2021). *Does online shopping make people feel better? The therapeutic effect of online shopping on Korean female consumers’ mood, self-esteem, and self-efficacy*. Journal of Global Scholars of Marketing Science.
- 소속: 서울대학교 의류학과, 한국폴리텍대학
- DOI: https://doi.org/10.1080/21639159.2020.1808821
- InPick 적용: 사용자의 선택이 이미지·견적에 즉시 반영되는 것을 보여주고, 예시·되돌리기·`잘 모르겠어요`·예산 내 대안을 제공한다.
- 한계: 한국 여성의 패션 쇼핑 결과를 전체 인테리어 시장에 일반화하지 않는다. 충동계약보다 저장·숙려·가족공유를 제공한다.

### K9. 완료 영역과 남은 영역

- Koo, M., & Fishbach, A. (2012). *The Small-Area Hypothesis: Effects of Progress Monitoring on Goal Adherence*. Journal of Consumer Research.
- 소속: Minjung Koo—성균관대학교, Ayelet Fishbach—University of Chicago
- DOI: https://doi.org/10.1086/663827
- 의미: 목표 초기에는 작은 완료 영역, 후반에는 작은 남은 영역에 주의를 기울이는 표시가 목표 지속과 관련됐다.
- InPick 적용: 초기에는 실제 완료된 주거정보·사진을, 후반에는 남은 확인 과업을 표시한다.
- 금지: `90% 완료` 뒤에 연락처·마케팅 동의를 추가하기.

## 4. 12단계 퍼널 행동설계

| 단계 | 핵심 장벽 | 윤리적 처치 | 실험군 / 대조군 | Primary KPI | Guardrail |
|---|---|---|---|---|---|
| 1. 유입 | 산출물·비용·한계 불명확 | 디자인→SKU→근거견적→최대 3개 비교, 무료 범위·시간·한계 동시 공개 | 구체 산출물 랜딩 / 브랜드 중심 랜딩 | Qualified Step1 start | 광고-실제 불일치, 즉시 포기 |
| 2. Step 1 | 질문·전문용어 부담 | 핵심 질문 3–5개, 조건부 분기, 이유, 모름, 자동저장 | 스캐폴딩 / 일괄 폼 | Step1 완료율 | 오입력·즉시 수정·접근성 오류 |
| 3. 사진 | 프라이버시·촬영실패 | 촬영 예시, 저장·삭제 요약, 가리기, 품질검사, 방 라벨 확인 | 코치+프라이버시 / 기본 파일선택 | Usable photo submission | 삭제요청·민감정보·오분류·업로드 실패 |
| 4. 무료 거실 | AI 결과 오인·다음 행동 불명확 | 입력→결과 매핑, AI 한계, 수정 이유, 정확한 다음 가격 | 설명 결과 / 이미지+CTA | Informed next-step | 구조·시공안 오인, 요구불일치 |
| 5. SKU·image-edit | 실제 상품 관계·옵션 과다 | 검증 SKU 3개, 전체 보기, 추천 이유, 견적 델타, 픽셀재현 한계 | 3개+비교 / 전체 그리드 | Validated SKU selection | SKU 오인·예산초과·공급사 편중 |
| 6. 잠금 해제 | 미끼·중복과금 불안 | 방별 가격·산출물·환불·재시도·나중에, 원자적 권한 | 투명 선택 / 가격+CTA | Informed reveal purchase | 후회·환불·중복과금·원본 누출 |
| 7. Step 3 | 총액 오인·누락 불신 | 공종·수량·단가·가정·포함/제외·범위·현장확인 | 근거 우선 / 총액 우선 | Estimate review completion | 확정가 오인·실견적 편차·누락 |
| 8. Decision Packet | 정보 분산·버전 혼선 | 불변 버전, 미확정 강조, 공유범위 미리보기 | 준비도 체크 / 자동 PDF | Packet readiness | 공유 후 정정·구버전·과다공유 |
| 9. 3-bid | 조건 불일치·최저가 편향 | 동일 line ID, 차이 이유, 다기준 정렬, 검증범위, 연락통제 | 정규화 비교 / 총액 카드 | Comparable bid rate | 추가비용·원치 않는 연락·편중 |
| 10. 상담 | 판매압박·맥락 유실 | 목적·채널·시간·연락상한, Packet 권한, 사전질문 | 통제형 예약 / 연락처 폼 | Qualified consultation completion | 노쇼·압박감·스팸·무단공유 |
| 11. 재방문 | 이어하기·변경 이해 어려움 | 실제 변경 diff, 사건 기반 opt-in 알림, 빈도·채널 | 사건 요약 / 주기 리마인더 | Meaningful return | 알림 차단·무행동 방문·구가격 오인 |
| 12. 공유 | 가족합의·민감정보·버전 | 목적별 권한, 주소·예산·원본 기본 제외, 만료·취소 | 안전 프리셋 / 단일 링크 | Safe collaborative share | 잘못 공유·민감정보·버전 혼선 |

## 5. 제품·콘텐츠 전략

### 5.1 유입 콘텐츠

주 메시지:

> 사진과 요구사항을 실별 디자인, 실제 제품 후보, 공종·수량·가격 근거로 연결합니다.

반드시 동시에 보여줄 한계:

- AI 이미지는 시각적 제안이다.
- 실제 색·무늬·치수·시공 가능성을 보증하지 않는다.
- Step 3는 현장실측 전 예상 범위다.
- 업체 제안 수는 지역·공종·일정에 따라 0–3개다.

검증 가능한 콘텐츠 포맷:

1. 동일 평형·공사범위의 `원본 → 요구사항 → 디자인 → SKU → 예상견적 → 최종계약 → 변경 → 실제비용` 사례.
2. 예쁜 이미지보다 최초 예상과 실제 비용 차이, 추가공사 원인, 공기 차이를 공개한 사례.
3. 업체 광고 콘텐츠는 광고·수수료 관계를 명시.
4. 리뷰는 일정·추가비용·품질·소통·A/S로 구조화.

### 5.2 Step 1 콘텐츠

- “정확한 답을 몰라도 됩니다.”
- 각 질문에 `왜 필요한가` 한 문장.
- 예산은 단일 숫자보다 범위.
- `모름`, `현장 확인 필요`, `나중에 결정`을 정상 선택으로 제공.
- 실제 완료된 항목만 진행률에 반영.

### 5.3 Step 2 콘텐츠·기능

- 실제 1차 생성 이미지에서 부위를 고른다.
- 검증 SKU 후보는 기본 3개, 전체 보기와 추천 이유를 제공한다.
- 모델번호·브랜드·규격·가격 출처·기준일·검증상태를 함께 표시한다.
- image-edit source와 SKU 선택을 동일 render identity에 결합한다.
- 화살표가 detector 결과가 아니면 `예상 위치`라고 명시하고 사용자가 위치를 보정할 수 있게 한다.
- 재생성 전 `정확한 상품 픽셀 재현을 보증하지 않음`을 지속적으로 표시한다.

### 5.4 Step 3 콘텐츠·기능

총액 위에 신뢰 배지를 붙이는 대신 다음을 제공한다.

- 입력 출처
- 수량 산식
- 단위
- 가격 출처·기준일
- SKU 검증 상태
- 포함·제외
- 현장 확인 필요
- 낙관/기준/보수 또는 예상 범위
- revision ID와 content hash

가격은 `필수`, `조건부`, `선택`으로 분리하고 낮은 시작가를 위해 후속 비용을 숨기지 않는다.

### 5.5 업체 비교·상담 콘텐츠

- 최대 3개이지 3개 보장이 아님을 명시한다.
- 같은 Decision Packet과 line item에 응답하게 한다.
- 총액보다 누락, 등급, 단위, 부가세, 일정, 보증, 예외를 먼저 비교한다.
- 업체 검증과 업체 자기주장을 분리한다.
- 리뷰 수보다 같은 공사유형의 고품질 리뷰와 부정 이슈 해결 여부를 우선한다.
- 사용자가 연락 채널·시간·횟수를 결정한다.

## 6. 실험 우선순위 백로그

### P0-1 측정·진실성 기반

구현:

- 공통 experiment assignment와 이벤트 스키마
- AI·SKU·견적 한계 확인 이벤트
- 견적 버전→최종 실견적→계약→변경→실제비용 연결
- 중복과금, 원본 누출, 원치 않는 연락, 개인정보 삭제 SLA 대시보드

완료 기준:

- 웹·iOS·Android·앱인토스에서 동일 이벤트 정의 사용
- 원본 사진·주소·전화번호·자유서술 원문은 분석 이벤트에 넣지 않음

### P0-2 Step 1 자기효능감 실험

- A: 현재 폼
- B: 예시+질문 이유+모름+즉시 확인+되돌리기
- Primary: Step1 완료율
- Quality: 입력 누락·모순·Step2 재생성 원인이 된 입력 오류
- Guardrail: 완료 직후 수정률, 도움말 반복, 접근성 오류

### P0-3 실제 진행률 실험

- A: 단계 번호
- B: 실제 완료한 항목과 남은 한 가지 행동
- Primary: 다음 단계 진입률
- Guardrail: 진행률 불일치, 필수정보 누락, 입력 정정

### P0-4 근거 우선 견적 실험

- A: 총액 우선
- B: 수량·단가·산식·범위·포함/제외 우선
- Primary: 견적 핵심 이해도 정답률
- Business secondary: 상담 시작, 유효 입찰 유지
- Guardrail: 확정가 오인, 실견적 편차, 추가비용 불만, Step3 이탈

### P0-5 사진 프라이버시·촬영 코치

- A: 기본 업로드
- B: 저장·삭제 요약+촬영예시+품질검사+민감정보 가리기
- Primary: usable photo submission
- Guardrail: 삭제요청, 민감정보 탐지, 실패·재업로드, 지원문의

### P1-1 SKU 선택 구조

- A: 전체 상품 그리드
- B: 설명 가능한 검증 SKU 3개+전체 보기+견적 델타
- Primary: 출처·규격 확인 후 저장한 SKU 비율
- Guardrail: 선택 번복, SKU 오인, 예산초과, 특정 공급사 편중
- 실행 조건: 해당 부위에 충분한 검증 SKU 커버리지 확보

### P1-2 인터랙티브 image-edit

- A: 이미지 갤러리
- B: 실제 source image에서 부위·SKU 교체, 되돌리기, 전후 비교
- Primary: 최종 디자인 저장률
- Guardrail: 반복 재생성·즉시 삭제·픽셀 동일성 오인·잠금 불만

### P1-3 Decision Packet

- A: 자동 PDF
- B: 준비도 체크+미확정 강조+공유 범위 선택+불변 버전
- Primary: 공유 가능한 Packet 확정률
- Guardrail: 정정·구버전·개인정보 과다 공유

### P2-1 검증된 사회적 증거

- A: 일반 팁
- B: 동일 평형·공사유형의 검증 집계와 구조화 리뷰
- Primary: 자격 있는 다음 단계 진행
- Guardrail: 오인 신고, 리뷰 신뢰도, 추천 숨기기, 표본 편향
- 실행 조건: 실제 프로젝트 연결, 최소 표본, 기간·분모·광고 관계 공개

### P2-2 3-bid 정규화

- A: 업체 카드와 총액
- B: 동일 line item, 차이 이유, 포함/제외, 다기준 정렬
- Primary: comparable bid rate
- Guardrail: 추가비용·입찰철회·원치 않는 연락·업체별 노출 편중

## 7. 실험 운영 규칙

### 사전 등록

실험 전에 다음을 고정한다.

- 가설
- 사용자 또는 프로젝트 단위 배정
- 1차 KPI 하나
- guardrail과 중단조건
- 제외 기준
- 분석 기간
- 최소 탐지 효과와 표본 계획
- 플랫폼·신규/재방문·자가/임차·예산대 사전 세그먼트

### 채택 기준

- 1차 KPI 개선과 최소 실질 효과를 모두 충족한다.
- 핵심 guardrail이 악화되면 채택하지 않는다.
- 전환 상승만으로 채택하지 않고 5초 이해도, 회상, 오인, 압박감 인터뷰를 병행한다.
- 웹·iOS·Android·앱인토스 효과를 합치기 전에 플랫폼 상호작용을 확인한다.
- 상담 클릭이 아니라 유효 입찰, 계약, 변경, 실제비용, 만족과 연결한다.

### 즉시 중단조건

- 잠긴 원본 URL 노출
- 중복 과금 또는 권한 부여 실패
- 확정가 오인 증가
- exact SKU 재현 오인 증가
- 개인정보 공유 후회·삭제 실패
- 원치 않는 업체 연락 증가
- 특정 취약 세그먼트의 피해 집중
- 광고·추천·후기 출처 오인

## 8. 최소 이벤트 스키마

공통 필드:

- `anonymous_user_id`
- `session_id`
- `project_id`
- `funnel_stage`
- `experiment_id`
- `variant`
- `timestamp`
- `artifact_version_id`
- `platform`

금지 필드:

- 원본 사진
- 전체 주소
- 전화번호
- 자유서술 원문
- private storage path 또는 signed URL

핵심 이벤트:

- `stage_started`, `stage_completed`, `stage_resumed`
- `requirement_changed`, `unknown_selected`
- `source_photo_uploaded`, `source_photo_deleted`, `photo_quality_failed`
- `render_generated`, `render_limit_viewed`
- `sku_candidate_viewed`, `sku_provenance_viewed`, `sku_selected`, `sku_fidelity_misunderstanding_reported`
- `unlock_terms_viewed`, `debit_attempted`, `grant_created`, `grant_restored`, `refund_requested`
- `estimate_assumption_viewed`, `estimate_assumption_changed`, `line_flagged`, `range_understood`
- `decision_packet_created`, `decision_packet_confirmed`, `decision_packet_shared`
- `rfq_published`, `bid_comparable`, `contact_preference_set`, `unwanted_contact_reported`
- `final_quote_delta_recorded`, `change_order_recorded`, `actual_cost_recorded`

## 9. 사업 KPI 구조

### North Star

- Informed Decision Packet Completion

### Activation

- Qualified Step1 start
- Step1 completion with valid requirements
- Usable photo submission
- Informed next-step after free living-room result

### Decision quality

- 검증 SKU 선택률
- 견적 이해도 정답률
- 견적 포함·제외 확인률
- Packet readiness
- comparable bid rate

### Revenue

- informed reveal purchase
- 유효 상담 완료
- 유효 입찰 수신
- 계약 전환
- 재료·공사 conversion

### Trust guardrails

- 결제 후회·환불
- 중복 과금
- 원본·개인정보 노출
- 확정가·SKU 오인
- 최초 예상 대비 최종 실견적·실제비용 편차
- 변경계약·추가비용 불만
- 원치 않는 연락
- 분쟁·A/S 미해결

## 10. 90일 실행안

### 0–30일

1. 이벤트·실험 assignment 정본 정의.
2. Step 1 스캐폴딩과 실제 진행률 실험.
3. 사진 촬영 코치와 프라이버시 요약.
4. Step 3 이해도 측정과 근거 우선 표현 prototype.
5. 사용자 인터뷰로 `AI 시공안`, `exact SKU`, `확정가` 오인 기준선 측정.

### 31–60일

1. 검증 SKU 커버리지가 있는 부위에서 3개 shortlist 실험.
2. source image 기반 SKU image-edit와 전후 비교.
3. Decision Packet V1과 불변 revision.
4. 예상견적→업체 실견적 차이 수집.

### 61–90일

1. 동일 line item 3-bid pilot.
2. 연락 통제형 상담.
3. 검증 리뷰 구조와 사례 schema.
4. 충분한 실제 데이터가 확보된 세그먼트에서만 사회적 증거 실험.
5. 최초 예상→계약→변경→실제비용 calibration 리포트.

## 11. 하지 않을 것

- “지금 N명이 보고 있습니다” 같은 검증 불가 수치
- 가짜 마감시간·재고·대기열
- 낮은 총액만 보여주고 필수 비용을 뒤에서 추가
- 검증되지 않은 제조사·SKU·가격 생성
- AI 이미지를 시공 결과나 exact SKU 재현으로 표현
- CSS blur만으로 유료 원본 보호
- 연락처를 얻기 위한 결과물 인질화
- 상담·공개 공유·마케팅 수신 기본 활성화
- 취소·삭제·옵트아웃을 어렵게 만들기
- 업체 광고·수수료를 추천 품질로 위장

## 12. 최종 판단

심리학은 사용자를 압박하는 장치가 아니라 **복잡한 인테리어 결정을 이해하고 수행할 수 있게 만드는 제품 엔진**으로 사용해야 한다.

InPick의 가장 방어력 있는 행동설계는 다음 연결이다.

`작은 성공으로 시작 → 실제 진척을 표시 → 자신의 이미지에서 직접 결정 → 실제 SKU와 견적 근거를 확인 → 같은 조건으로 업체를 비교 → 변경과 실제비용까지 학습`

이 연결이 구현되면 단기 전환뿐 아니라 견적 신뢰, 유효 상담, 비교 가능한 입찰, 낮은 추가비용 충격, 재방문·추천을 함께 개선할 수 있다. 반대로 사회적 증거·진행감·처리유창성을 진실성 없이 사용하면 InPick의 가장 중요한 자산인 신뢰를 훼손한다.
