# INPICK Codex × Claude Code 협업 규칙

## 역할

- Codex: 아키텍처, 작업 분해, 파일 소유권, 최종 diff 검수, 통합, 운영 검증
- `inpick-reviewer`: 구현과 분리된 읽기 전용 교차 검수
- `inpick-implementer`: 명확한 반복 구현과 테스트를 별도 worktree에서 수행

## 기본 흐름

1. Codex가 목표, 허용 파일, 금지 범위, 수용 기준, 검증 명령을 작업지시서로 만든다.
2. 리뷰는 `inpick-reviewer`, 구현은 `inpick-implementer`에 맡긴다.
3. 같은 파일을 Codex와 Claude가 동시에 수정하지 않는다.
4. Claude는 커밋·푸시·배포를 하지 않는다.
5. Codex가 결과 diff를 읽고 테스트한 뒤 필요한 부분만 통합한다.

## Claude Code에서 호출

```text
inpick-reviewer 에이전트를 사용해서 <파일 목록>의 현재 diff를 <수용 기준>에 따라 검토해.
```

```text
inpick-implementer 에이전트를 사용해서 다음 작업을 별도 worktree에서 수행해.
목표: ...
수정 허용 파일: ...
수정 금지: ...
수용 기준: ...
검증 명령: ...
완료 후 커밋하지 말고 worktree 경로와 diff 요약을 보고해.
```

## 작업 분배 기준

- Claude 적합: 일괄 타입 정리, 반복 UI 상태 추가, 테스트 케이스 확장, 명확한 리팩터링, 독립 코드 리뷰
- Codex 유지: 데이터 모델과 API 계약 결정, 운영 DB/RunPod/Vercel 변경, 보안 경계, 서로 얽힌 통합, 최종 배포 판단

## 안전 규칙

- 프로젝트에는 사용자 작업이 섞인 dirty worktree가 있을 수 있다.
- 구현 에이전트는 worktree 격리를 사용하고 `.env*`를 복사하지 않는다.
- 비밀키, 운영 DB 변경, 결제, 외부 메시지, 배포는 Claude에 위임하지 않는다.
- 리뷰 결과는 권고안이며 Codex 검수 전에는 완료로 간주하지 않는다.
