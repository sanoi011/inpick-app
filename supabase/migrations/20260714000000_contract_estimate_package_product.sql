-- 기존 9,900원 단발 PDF 상품을 공정위 공식 표준계약서가 포함된
-- 계약견적서 패키지로 명확히 표시한다. 상품코드/가격/IAP 매핑은 유지한다.
UPDATE payment_products
SET
  name_ko = '계약견적서 패키지',
  description_ko = '공정위 제10079호 실내건축·창호 공사 표준계약서 원본과 견적 갑지·총괄표·세부내역·디자인 이미지·특기사항·서명란을 포함한 PDF 세트',
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'document_package', 'contract_estimate',
    'standard_contract_no', '10079',
    'includes_vat', true
  ),
  updated_at = now()
WHERE code = 'estimate_pdf_single';
