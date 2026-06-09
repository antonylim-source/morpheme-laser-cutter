# [AP-CONT-02] 게임 점수·Combo·Miss·난이도 (Pick your level)

## 개요

**Morpheme Laser Cutter**는 합성어 괴물의 **형태소 경계(가운데)**를 레이저로 자르는 활동입니다.  
상단 HUD에는 **Score**, **Combo**, **Miss**가 표시되며, 시작 화면에서 **Pick your level**로 난이도를 선택합니다.

| 항목 | UI 라벨 | 내부 상태 | 설명 |
|------|---------|-----------|------|
| 점수 | Score | `state.score` | 정답 시 누적 |
| 연속 성공 | Combo | `combo` (App 로컬 state) | 연속 정답 횟수 (단어 단위) |
| 실수 | Miss | `state.failCount` | **현재 단어**에서의 오답 횟수 (0~3) |

---

## 슬래시 정답 판정 (공통 기준)

Score·Combo·Miss 모두 아래 **슬래시 정답/오답 판정** 결과에 따라 결정됩니다.

### 정답 조건

```
diff = |touchX - boundaryPixelX|
정답: diff ≤ tolerance (난이도별 허용 오차)
```

| 변수 | 의미 |
|------|------|
| `touchX` | 스와이프 궤적이 **단어 높이(`WORD_Y_POSITION = 400`)** 를 지날 때의 X좌표 |
| `boundaryPixelX` | 단어 데이터 `boundaryIndex`로 계산한 **형태소 경계 X좌표** |
| `tolerance` | Pick your level에서 선택한 난이도의 허용 오차 (`AGE_TOLERANCE`) |

- 판정 로직: `laser-hunter/src/hooks/useBoundaryCheck.ts`
- 경계 X 계산: `laser-hunter/src/utils/monsterLayout.ts`, `wordTextMetrics.ts`
- 시각적 경계 위치: 인접 글자 사이 **간격 중앙** (`getVisualBoundaryOffsetX`)

### 슬래시가 시도로 인정되는 선행 조건

| 조건 | 기준 |
|------|------|
| 게임 상태 | `status === 'playing'` 이고 게임 오버 아님 |
| 세로 스와이프 | 시작~끝 Y 차이 **> 30px** (가로 드래그는 무시) |
| 단어 노출 | `approachProgress ≥ 0.95` (`isWordSlashable`) — 괴물이 충분히 가까워져 단어가 보일 때만 |
| 판정 X 계산 | 스와이프 선이 `wordY = 400` 높이를 지나는 지점의 X (`getSlashXAtWordY`) |

대각선 스와이프도 단어 높이에서의 X로 보정하므로, 손가락이 살짝 기울어져도 그 높이 기준으로 판정합니다.

### 판정 흐름

```
스와이프 종료
  → 세로 이동 > 30px?
  → 단어 노출 ≥ 95%?
  → wordY=400에서 slashX 계산
  → diff = |slashX - boundaryPixelX|
  → diff ≤ tolerance? → 정답 / 오답
```

---

## Score (점수)

### 규칙

| 이벤트 | 기준 | 결과 |
|--------|------|------|
| 정답 슬래시 | `result.isCorrect === true` | **+100점**, `failCount` 0으로 리셋 |
| 오답 | `diff > tolerance` | 점수 변화 없음 |
| 힌트 후 다음 단어 | 3회 Miss | 점수 변화 없음 (기존 점수 유지) |

- 한 세션 **10단어** 동안 누적
- 단어당 최대 **100점** (정답 1회만 인정)
- 게임 오버 화면에 **총 점수**로 표시

### UI·연출

- 표시 위치: 상단 HUD `ScoreBoard` (⭐ Score)
- 값 변경 시 `animate-score-pop` 애니메이션 재생

### 관련 소스

- 점수 증가: `laser-hunter/src/hooks/useGameState.ts` — `ATTEMPT_CUT` 성공 시 `score + 100`
- UI: `laser-hunter/src/components/ScoreBoard/ScoreBoard.tsx`
- 게임 오버: `laser-hunter/src/components/GameOverScreen/GameOverScreen.tsx`

---

## Combo (연속 성공)

### 규칙

Combo는 **단어 단위 연속 정답** 횟수입니다. `App.tsx`에서 `state.status` 변화로 관리합니다.

| 상태 변화 | Combo |
|-----------|-------|
| `success` | **+1** |
| `fail` (1~2회 Miss) | **0으로 리셋** |
| `hint` (3회 Miss) | **0으로 리셋** |
| 게임 리셋 / 다시 도전 | **0** |

> 같은 단어에서 1~2번 틀렸다가 맞추면 Combo는 **1**부터 다시 셉니다. (fail 시 이미 0으로 리셋됨)

### 정답 시 피드백 단계

| 다음 combo | 팝업 (`FeedbackKind`) | 사운드 |
|------------|----------------------|--------|
| 1 | `slice` | `success` |
| 2~3 | `great` | combo ≥ 3이면 `combo` |
| 4+ | `super` | `combo` |

### 시각 효과

| combo | 효과 |
|-------|------|
| ≥ 2 | ScoreBoard Combo 배지 강조 (`animate-wiggle`), 상단 `"🔥 N Combo!"` 표시 |
| ≥ 2 | 레이저 색상 warm 톤 (GameCanvas) |
| ≥ 3 | 레이저 색상 hot 톤 (더 밝은 글로우) |

### 관련 소스

- combo 관리: `laser-hunter/src/App.tsx`
- HUD: `laser-hunter/src/components/ScoreBoard/ScoreBoard.tsx`
- 레이저 색상: `laser-hunter/src/components/GameCanvas/GameCanvas.tsx`

---

## Miss (실수)

### 표시 의미

ScoreBoard의 **Miss**는 세션 전체 누적이 아니라 **`failCount`(현재 단어 오답 횟수)** 입니다.

- 범위: **0 ~ 3**
- 3회 도달 시 힌트 모달로 전환 (`status = 'hint'`)

### 오답 처리 흐름

```
오답 (diff > tolerance)
  → failCount + 1 (최대 3)
  → failCount < 3: status = 'fail'  → 약 900ms 후 재시도 (playing)
  → failCount = 3: status = 'hint'  → 정답 힌트 모달 → 다음 단어 (1500ms)
```

### Miss에 따른 게임플레이 변화

Pick your level과 **무관**하게, 현재 단어의 `failCount`에 따라 몬스터·단어가 커지고 빨라집니다.

| failCount | 몬스터 속도 | 몬스터·단어 크기 | 인게임 힌트 | 피드백 |
|-----------|-------------|------------------|-------------|--------|
| 0 | 220 px/s | ×1.0 | 없음 | — |
| 1 | 297 px/s | ×1.5 | 단어 불꽃 연출 | `grow` 사운드, `oops` 팝업 |
| 2 | 374 px/s | ×2.25 | 경계 **노란 점** 표시 | `boom` 팝업 |
| 3 | 451 px/s | ×3.375 | — (힌트 모달) | morpheme1 \| morpheme2 안내 |

**속도 공식**

```
speed = monsterBaseSpeed × (1 + failCount × (monsterSpeedUpOnFail - 1))
      = 220 × (1 + failCount × 0.35)  [px/s]
```

**크기 공식**

```
scale = monsterScaleUpOnFail ^ failCount
      = 1.5 ^ failCount
```

### 힌트 단계 (인게임)

`HintOverlay`에서 `level = failCount` (1~3)로 표시합니다.

| level (failCount) | 인게임 표시 (playing 중) |
|-------------------|--------------------------|
| 1 | 오버레이 활성 (시각 연출 위주 — 단어 불꽃 등) |
| 2 | 경계 위치 **노란 점** 2개 (상·하) |
| 3 | `status`가 즉시 `hint`로 전환 → **힌트 모달** (morpheme 분리 안내) |

> failCount = 3이 되면 `playing` 상태가 아니므로, level 3 인게임 오버레이(초록 선 + "여기를 베어요!")는 실질적으로 표시되지 않고 힌트 모달이 대신 나타납니다.

### 정답·단어 전환 시

- 정답 시: `failCount` → 0
- 다음 단어(`NEXT_WORD`)로 넘어갈 때도 0으로 초기화

### 관련 소스

- 상태 전이: `laser-hunter/src/hooks/useGameState.ts`
- 속도·크기: `laser-hunter/src/utils/monsterLayout.ts`, `gameConfig.ts`
- 힌트 UI: `laser-hunter/src/components/HintOverlay/HintOverlay.tsx`

---

## Pick your level (난이도 선택)

시작 화면(`StartScreen`)에서 선택하며, **게임 시작 전에만** 변경 가능합니다.  
기본값: **Normal** (`standard`).

### 난이도 목록

| UI 표시 | 내부 값 (`AgeMode`) | 허용 오차 (px) | 체감 |
|---------|---------------------|----------------|------|
| 🐣 Easy | `young` | **20** | 경계 판정이 가장 넓음 |
| ⚡ Normal | `standard` | **18** | 기본 난이도 |
| 🔥 Hard | `advanced` | **12** | 경계 판정이 가장 엄격함 |

```ts
// laser-hunter/src/constants/gameConfig.ts
AGE_TOLERANCE = { young: 20, standard: 18, advanced: 12 }
```

### 난이도가 영향을 주는 것

| 항목 | Easy / Normal / Hard별 차이 |
|------|------------------------------|
| 슬래시 정답 판정 허용 범위 | ✅ 차이 있음 (20 / 18 / 12 px) |
| 몬스터 속도 | ❌ 동일 (`failCount` 기준) |
| 몬스터·단어 크기 | ❌ 동일 (`failCount` 기준) |
| Miss 힌트 단계 | ❌ 동일 (`failCount` 기준) |
| Score (+100) | ❌ 동일 |
| Combo 규칙 | ❌ 동일 |
| 세션 단어 수 (10) | ❌ 동일 |

### 판정 예시

`boundaryPixelX = 640`일 때:

| 난이도 | 정답 범위 (touchX) |
|--------|-------------------|
| Easy | 620 ~ 660 (±20px) |
| Normal | 622 ~ 658 (±18px) |
| Hard | 628 ~ 652 (±12px) |

### 개발 모드

- `?` 키 (DEV 환경): 캔버스에 선택 난이도의 tolerance 영역(반투명 박스)과 경계선 표시

### 관련 소스

- UI: `laser-hunter/src/components/StartScreen/StartScreen.tsx`
- 판정: `laser-hunter/src/hooks/useBoundaryCheck.ts`
- 상수: `laser-hunter/src/constants/gameConfig.ts` — `AGE_TOLERANCE`

---

## 세션 진행 (참고)

| 항목 | 값 |
|------|-----|
| 한 판 단어 수 | **10** |
| Progress 표시 | 하단 `wordsDone / 10` 별 |
| 정답 후 자동 다음 단어 | **1800ms** |
| 힌트(3 Miss) 후 자동 다음 단어 | **1500ms** |
| 오답 후 재시도 대기 | **900ms** |
| 게임 오버 별 등급 | `floor((wordsCompleted / 10) × 3)` (최대 3개) |

---

## 컨텐츠 제작 체크리스트

- [ ] 단어 `boundaryIndex`가 실제 morpheme 경계와 일치하는지
- [ ] Easy(20px) / Normal(18px) / Hard(12px)에서 체감 난이도가 의도대로인지
- [ ] 3 Miss 시 힌트 모달 — morpheme 분리 표기 확인
- [ ] Combo 2·4 구간 피드백·사운드·레이저 색 변화 확인
- [ ] Score +100, 게임 오버 총점 표시 확인
- [ ] Miss 1~2회 시 몬스터 커짐·빨라짐 연출 확인

---

## 관련 소스 파일

| 파일 | 역할 |
|------|------|
| `laser-hunter/src/constants/gameConfig.ts` | `AGE_TOLERANCE`, 몬스터 속도·스케일 상수 |
| `laser-hunter/src/hooks/useGameState.ts` | score, failCount, 상태 전이 |
| `laser-hunter/src/hooks/useBoundaryCheck.ts` | 난이도별 경계 판정 |
| `laser-hunter/src/App.tsx` | combo, 세션(10단어), 피드백 |
| `laser-hunter/src/components/ScoreBoard/ScoreBoard.tsx` | Score / Combo / Miss HUD |
| `laser-hunter/src/components/StartScreen/StartScreen.tsx` | Pick your level UI |
| `laser-hunter/src/components/HintOverlay/HintOverlay.tsx` | Miss 단계별 힌트 |
| `laser-hunter/src/components/GameCanvas/GameCanvas.tsx` | 슬래시 입력·판정 X·레이저 연출 |
| `laser-hunter/src/utils/monsterLayout.ts` | failCount별 속도·크기 계산 |
| `laser-hunter/src/utils/wordTextMetrics.ts` | 경계 X 좌표 계산 |
| `laser-hunter/src/data/wordList.ts` | 단어별 `boundaryIndex` 데이터 |
