# Manual Index -> Supabase (pgvector) Migration

## 목표
- `manual_index.json`을 Supabase DB로 이관해 검색을 DB 기반으로 전환합니다.
- Vercel에서 대용량 JSON 파싱을 제거합니다.

## 1) 테이블 생성
Supabase SQL Editor에서 `web/docs/manual_index_pgvector.sql` 실행

## 2) 임베딩 생성 전략 (권장)
- text -> embedding (OpenAI / 기타 embedding API)
- embedding dimension은 1536 기준 (다른 모델이면 SQL 벡터 차원 수정)

## 3) 마이그레이션 전략
- `manual_index.json`의 각 chunk를 `manual_chunks`로 INSERT
- id: 기존 chunk id
- entry_id, model, manual_type, title, file, page_start/end, text
- embedding: 생성 후 저장

## 4) 검색 쿼리 예시
```sql
select id, entry_id, model, manual_type, title, file, page_start, page_end, text
from manual_chunks
order by embedding <=> :query_embedding
limit 20;
```

## 5) Next.js API 전환 방향
- `/api/search`에서 manual_index.json 대신
  Supabase DB `manual_chunks`로 검색
- fallback으로 manifest 검색 유지 가능

## 참고
- embedding 비용 때문에 초기에는 `text` LIKE 검색으로 시작해도 됨
- 추후 pgvector 기반으로 성능/정확도 개선
