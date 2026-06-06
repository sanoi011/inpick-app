-- 사업자 전용 커뮤니티 게시판 추가 (pro-* slug → CommunityShell에서 '사업자 게시판' 그룹으로 분류)
-- board_type은 community_boards CHECK 제약이 없으므로 enum 내 값('general','materials') 사용.

INSERT INTO community_boards (slug, name, description, board_type, sort_order, allow_user_posts, allow_contractor_replies) VALUES
  ('pro-lounge',    '사업자 라운지',     '검증 사업자 자유게시판 · 운영/영업 이야기', 'general',   110, TRUE, TRUE),
  ('pro-knowhow',   '시공 노하우',       '현장 팁 · 공법 · 하자 대응 · 자재 후기', 'general',   120, TRUE, TRUE),
  ('pro-materials', '자재 도매·납품',    '자재 도매처 · 공동구매 · 납품 정보', 'materials', 130, TRUE, TRUE),
  ('pro-jobs',      '구인구직',          '시공팀/기공/보조 구인구직', 'general',   140, TRUE, TRUE)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  board_type = EXCLUDED.board_type,
  sort_order = EXCLUDED.sort_order,
  allow_user_posts = EXCLUDED.allow_user_posts,
  allow_contractor_replies = EXCLUDED.allow_contractor_replies;
