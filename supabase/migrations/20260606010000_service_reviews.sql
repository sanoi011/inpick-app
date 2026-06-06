-- 서비스별 리뷰(후기) — 아정당(ajd.co.kr) 스타일: 서비스 카테고리 태그 + 익명 닉네임 + 평가 텍스트
-- service_type: full_interior(전체 인테리어) | partial(부분 인테리어·자재추천) | material_preview(자재 미리보기)

create table if not exists service_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  service_type text not null check (service_type in ('full_interior', 'partial', 'material_preview')),
  rating int not null default 5 check (rating between 1 and 5),
  title text,
  content text not null,
  author_name text,            -- 입력 닉네임/이름 (표시 시 마스킹)
  region text,                 -- 예: 대전 유성구
  project_ref text,            -- 선택: 연결 프로젝트/견적 식별자
  photos jsonb default '[]'::jsonb,
  is_published boolean default true,
  created_at timestamptz default now()
);

create index if not exists service_reviews_service_idx
  on service_reviews (service_type, created_at desc);

alter table service_reviews enable row level security;

drop policy if exists "service_reviews public read" on service_reviews;
create policy "service_reviews public read"
  on service_reviews for select using (is_published = true);

drop policy if exists "service_reviews insert own" on service_reviews;
create policy "service_reviews insert own"
  on service_reviews for insert with check (auth.uid() = user_id);

drop policy if exists "service_reviews update own" on service_reviews;
create policy "service_reviews update own"
  on service_reviews for update using (auth.uid() = user_id);

-- 초기 샘플 후기 (운영 데이터 쌓이기 전 노출용)
insert into service_reviews (service_type, rating, content, author_name, region, created_at) values
  ('full_interior', 5, '주소만 넣었는데 도면이랑 견적이 바로 나와서 놀랐어요. 17공종으로 쪼개주니 어디에 돈이 드는지 한눈에 보였습니다.', '김民수', '대전 유성구', now() - interval '2 days'),
  ('full_interior', 5, '여러 업체 견적 비교가 이렇게 쉬울 줄 몰랐어요. 표준 단가 기준이라 바가지 걱정이 줄었습니다.', '이서연', '서울 강남구', now() - interval '5 days'),
  ('full_interior', 4, 'AI 디자인 제안이 생각보다 실용적이었어요. 실제 시공까지 매끄럽게 이어졌습니다.', '박준호', '경기 수원시', now() - interval '9 days'),
  ('partial', 5, '변기만 교체하려고 했는데 배수심·급수 위치까지 물어봐서 정확한 견적이 나왔어요. 시공자 연결도 빨랐습니다.', '최지우', '대전 서구', now() - interval '1 days'),
  ('partial', 5, '문고리 교체 같은 작은 것도 자재 추천부터 시공비까지 깔끔하게 정리해줘서 좋았어요.', '정현우', '인천 연수구', now() - interval '4 days'),
  ('partial', 4, '세면대 교체 자재 후보를 가격대별로 보여줘서 고르기 편했습니다.', '한가람', '부산 해운대구', now() - interval '7 days'),
  ('material_preview', 5, '우리집 거실 바닥에 마루를 적용해본 미리보기가 실제랑 비슷해서 결정에 큰 도움이 됐어요.', '오세훈', '대전 중구', now() - interval '3 days'),
  ('material_preview', 5, '벽지 한 면만 포인트로 바꿔보는 걸 미리 볼 수 있어서 시공 전에 확신이 생겼습니다.', '윤다은', '경기 성남시', now() - interval '6 days'),
  ('material_preview', 4, 'ㄱ자 주방에 상판/도어 색을 바꿔보며 비교하니 선택이 쉬웠어요.', '강태리', '서울 마포구', now() - interval '10 days')
on conflict do nothing;
