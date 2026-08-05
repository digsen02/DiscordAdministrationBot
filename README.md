# Discord Organization Manager

Discord 서버의 역할을 읽어 학생회, 운영진, 길드, 의회 같은 조직의 현재 구성과 임기를 게시하는 봇입니다. 역할이 바뀌면 일반 채널 메시지나 포럼 게시물을 같은 자리에서 갱신합니다. 봇은 역할을 직접 부여하거나 회수하지 않습니다.

- [봇 소개](#봇-소개)
- [사용 전에 준비할 것](#사용-전에-준비할-것)
- [10분 안에 첫 게시물 만들기](#10분-안에-첫-게시물-만들기)
- [주요 기능 사용법](#주요-기능-사용법)
- [실제 설정 예시](#실제-설정-예시)
- [자주 생기는 문제](#자주-생기는-문제)
- [현재 제한사항](#현재-제한사항)
- [상세 문서](#상세-문서)
- [개발자 참고](#개발자-참고)

## 봇 소개

봇은 서버에 이미 있는 Discord 역할을 조직의 **직책** 또는 **구성원**으로 연결합니다. 예를 들어 `@학생회장`은 1명인 필수 직책, `@학생회`는 여러 명인 구성원으로 설정할 수 있습니다. 게시물은 현재 역할 보유자, 임기, 분류와 추가 정보를 Liquid 양식에 넣어 만듭니다.

관리 명령과 패널은 명령을 실행한 관리자에게만 보입니다. 한 서버에 여러 조직을 만들거나, 같은 조직을 여러 채널에 서로 다른 양식으로 게시할 수 있습니다.

처음에는 다음 네 용어만 알면 됩니다.

| 용어 | 뜻 | 예시 |
|---|---|---|
| 조직 | 한 묶음으로 관리할 단체 | 학생회, 국가의회 |
| 직책 | 특정 책임을 맡은 역할. 보통 1명 여부와 필수 여부를 검사 | 학생회장, 의장 |
| 구성원 | 조직에 속한 여러 사람을 나타내는 역할 | 학생회, 의원 |
| 템플릿 | 조직 정보를 Discord 글로 바꾸는 양식 | `{{ organization.name }}` |

key는 템플릿이 항목을 찾는 짧은 영문 이름입니다. 서버 구성원에게는 보이지 않지만 처음 만든 뒤에는 현재 패널에서 바꿀 수 없으므로 `student_council`, `president`, `member`처럼 뜻을 알아보기 쉽게 정하세요.

## 사용 전에 준비할 것

- Node.js 22 이상과 npm
- Discord 애플리케이션의 봇 토큰과 Application ID
- 관리할 서버의 **서버 관리** 권한
- 조직 구성원에게 부여할 Discord 역할
- 봇이 글을 올릴 텍스트·공지·포럼 채널

Developer Portal의 **Bot → Privileged Gateway Intents**에서 **Server Members Intent**를 켜세요. 초대 URL에는 `bot`, `applications.commands` scope와 다음 권한이 필요합니다.

| 권한 | 용도 |
|---|---|
| View Channels, Read Message History | 채널과 기존 게시물 찾기 |
| Send Messages | 일반 채널 게시 |
| Create Public Threads, Send Messages in Threads | 포럼 글 생성·수정 |
| Manage Threads | 포럼 제목·태그·보관·잠금 갱신 |

봇 계정에 `Administrator` 권한을 줄 필요는 없습니다. 채널별 권한 덮어쓰기에서 위 권한이 허용되어 있는지만 확인하세요.

## 10분 안에 첫 게시물 만들기

아래 흐름은 `학생회`, `@학생회장`, `@학생회`, `#학생회-안내`를 끝까지 사용합니다.

### 1. 설치

프로젝트 폴더에서 다음 명령을 실행합니다.

```powershell
npm install
Copy-Item .env.example .env
```

`.env`를 열고 값을 입력합니다.

```dotenv
DISCORD_TOKEN=봇_토큰
DISCORD_CLIENT_ID=Application_ID
DISCORD_DEV_GUILD_ID=테스트할_서버_ID
DATABASE_URL=./data/bot.db
LOG_LEVEL=info
```

`DISCORD_DEV_GUILD_ID`는 명령을 빠르게 등록할 개발 서버입니다. 서버 ID는 Discord 개발자 모드에서 서버 아이콘을 오른쪽 클릭해 복사합니다. 이어서 실행합니다.

```powershell
npm run db:migrate
npm run commands:register
npm run dev
```

`Discord bot ready`가 출력되고 Discord에서 봇이 온라인이면 준비가 끝났습니다.

### 2. 조직 생성

`/org create`를 실행하고 다음 값을 입력합니다.

```text
name: 학생회
key: student_council
description: 우리 서버 학생회
```

이름은 화면에 보이는 값이고, key는 봇 내부에서 조직을 구분하는 짧은 영문 이름입니다. 생성 후 **조직 관리 · 학생회** 패널이 열립니다.

### 3. Discord 역할 연결

조직 패널에서 **관리할 영역 선택 → 역할 및 직책 → 역할 추가**를 누릅니다.

1. `@학생회장`을 선택하고 `president`, `학생회장`, `office, one, true, 0`을 입력합니다. 이는 “직책, 1명, 필수, 첫 번째 표시”라는 뜻입니다.
2. 다시 **역할 추가**에서 `@학생회`를 선택하고 `member`, `학생회`, `membership, many, false, 10`을 입력합니다. 이는 “구성원, 여러 명, 선택, 나중 표시”라는 뜻입니다.

저장 후 역할 목록에 두 역할과 현재 보유 인원이 보입니다. `office`, `membership`, `one`, `many`는 이 입력란에서만 필요한 내부 값입니다.

### 4. 임기 시작

`/term start`에서 조직 이름을 자동 완성으로 고르고 다음 값을 입력합니다.

```text
organization: 학생회
name: 2026 학생회
```

시작 시각을 비우면 지금 시작하며 종료 시각을 비우면 무기한입니다. 완료 후 임기 패널에 `2026 학생회`와 **진행 중** 상태가 표시됩니다.

### 5. 템플릿 작성

`/template create organization:학생회 name:기본 현황`을 실행하고 **직접 입력**을 누른 뒤 붙여 넣습니다.

```liquid
# {{ organization.name }}
현재 임기: {{ term.name | default: "없음" }}
학생회장: {{ roles.president.joinedMentions | default: "공석" }}
구성원: {{ roles.member.count | number }}명
```

`{{ ... }}` 부분이 실제 조직 정보로 바뀝니다. 저장 후 템플릿 패널에서 **미리보기**를 눌러 결과와 2,000자 제한을 확인합니다.

### 6. 게시물 생성

`/publication create`를 실행합니다.

```text
organization: 학생회
channel: #학생회-안내
name: 학생회 현황
auto_refresh: True
```

목록에서 **기본 현황**을 선택하면 게시 설정이 저장되고 상세 패널이 열립니다. **미리보기 → 저장하고 게시**를 누르면 `#학생회-안내`에 첫 메시지가 나타납니다. 템플릿 ID를 입력할 필요는 없습니다.

### 7. 자동 갱신 확인

Discord에서 한 사람의 `@학생회` 역할을 추가하거나 제거합니다. 약 5초 뒤 새 메시지가 생기는 대신 기존 메시지의 구성원 수가 바뀌면 완료입니다. 즉시 확인하려면 `/publication refresh`에서 `학생회 현황`을 자동 완성으로 선택하세요.

## 주요 기능 사용법

모든 관리 작업은 `/org manage`, `/template manage`, `/publication manage`에서 이름을 선택해 시작합니다.

| 기능 | 어디에서 여는가 | 무엇을 설정하고 언제 쓰는가 | 설정 후 변화와 주의점 |
|---|---|---|---|
| 조직 대시보드 | `/org manage` | 역할, 분류, 추가 정보, 임기, 템플릿, 게시물의 상태 확인 | **관리할 영역 선택**으로 이동합니다. 조직 삭제는 **고급 관리**에 있습니다. |
| 역할과 직책 | 조직 → **역할 및 직책** | Discord 역할을 직책 또는 구성원으로 연결하고 1명/여러 명, 필수 여부, 순서 지정 | 역할 보유자와 경고가 게시물에 반영됩니다. 봇이 역할 자체를 바꾸지는 않습니다. |
| 분류 | 조직 → **구성원 분류** | 구성원 역할을 기준으로 정당·부서·팀 역할별 인원 계산 | 하나만 허용하는 분류에서 역할이 겹치면 경고하며 중복 인원은 어느 그룹에도 세지 않습니다. |
| 사용자 정의 필드 | 조직 → **추가 정보** | 설립일, 소재지, 선출 방식처럼 Discord 역할에 없는 값 저장 | 조직 범위 값은 계속 유지되고 임기 범위 값은 현재 임기에 붙습니다. 날짜는 `YYYY-MM-DD`로 입력합니다. |
| 임기 | `/term start`, `/term manage` | 즉시 또는 ISO 8601 시각에 시작하고 일시 중지·재개·종료 | 예약 임기는 분 단위 점검으로 시작되고 종료 예정 시각이 지나면 만료됩니다. 현재 패널에서는 시작 후 이름·날짜를 편집할 수 없습니다. |
| 템플릿 | `/template create`, `/template manage` | 직접 입력, UTF-8 `.txt` 가져오기, 같은 조직 템플릿 복제 | 미리보기 후 사용 가능/초안을 전환합니다. 초안은 새 게시물에서 선택할 수 없습니다. |
| 일반 게시물 | `/publication create`에서 텍스트·공지 채널 선택 | 템플릿, 이름, 자동 갱신 선택 | 처음에는 메시지를 만들고 이후 같은 메시지를 수정합니다. 대상 채널은 나중에 바꿀 수 없습니다. |
| 포럼 게시물 | `/publication create`에서 포럼 선택 | 본문·제목 템플릿, 태그, 보관 시간, slowmode, 보관·잠금 설정 | thread와 starter message를 유지합니다. 잠근 글은 다음 갱신이 실패합니다. |
| 자동 갱신 | 게시물 → **설정 및 기타 작업 → 자동 갱신 설정** | 역할 변경을 기존 글에 자동 반영 | 관련 역할 변화, 일부 패널 변경, 예약 임기 전환, 봇 재시작 후 약 5초 단위로 처리합니다. 설정 변경 뒤 즉시 반영되지 않으면 **지금 갱신**을 누르세요. |
| 진단 | `/diagnose` | 서버 전체, 조직 또는 게시물의 끊어진 역할·채널·글과 최근 오류 확인 | 이름 자동 완성으로 대상을 고릅니다. 진단은 문제를 보여 주며 자동으로 고치지는 않습니다. |

템플릿은 다음 순서로 익히면 됩니다.

```liquid
{{ organization.name }}                                      {%- comment %} 조직 {%- endcomment %}
{{ term.name | default: "현재 임기 없음" }}                 {%- comment %} 현재 임기 {%- endcomment %}
{{ roles.president.joinedMentions | default: "공석" }}       {%- comment %} 직책 보유자 {%- endcomment %}
{% for group in classifications.party.groups %}{{ group.displayName }} {{ group.count }}명{% endfor %}
{{ fields.location | default: "미정" }}                      {%- comment %} 추가 정보 {%- endcomment %}
{{ term.startDate | date_long }} / {{ value | percentage: 1 }}
```

`percentage`가 `%`까지 붙이므로 뒤에 `%`를 추가하지 마세요. 전체 변수와 필터는 [템플릿 가이드](docs/TEMPLATE_GUIDE.md)에 있습니다.

## 실제 설정 예시

### 간단한 학생회

필요한 Discord 역할은 `@학생회장` 1명과 `@학생회` 여러 명입니다.

| 항목 | 설정 |
|---|---|
| 조직 생성 | 이름 `학생회`, key `student_council`, 설명 `우리 서버 학생회` |
| 역할 연결 | `@학생회장` → `president`, 학생회장, `office, one, true, 0` |
| 역할 연결 | `@학생회` → `member`, 학생회, `membership, many, false, 10` |
| 분류 | 사용하지 않음 |
| 사용자 정의 필드 | 사용하지 않음 |
| 임기 | `2026 학생회`, `2026-03-01T00:00:00+09:00`, 종료 예정 없음 |
| 게시 | `#학생회-안내`, 이름 `학생회 현황`, 자동 갱신 켜기 |

전체 템플릿:

```liquid
# {{ organization.name }}

현재 임기: {{ term.name | default: "없음" }}
시작일: {% if term %}{{ term.startDate | date_long }}{% else %}미정{% endif %}
학생회장: {{ roles.president.joinedMentions | default: "공석" }}
학생회 구성원: {{ roles.member.count | number }}명

{% if warnings.size > 0 %}## 확인 필요
{% for warning in warnings %}- {{ warning }}
{% endfor %}{% endif %}
```

김민지가 회장이고 학생회 역할 보유자가 4명이면 Discord에는 다음처럼 보입니다.

```text
# 학생회

현재 임기: 2026 학생회
시작일: 2026년 03월 01일
학생회장: @김민지
학생회 구성원: 4명
```

### 정당 분류가 있는 국가의회

필요한 역할은 `@국가의회의장` 1명, `@국가의회의원` 여러 명, 분류할 `@무소속`입니다.

```text
조직 이름: 국가의회
key: reichstag
설명: 서버 국가의 입법 기관
외국어 이름: Reichstag
발음: 라이히스탁
```

현재 패널은 조직의 외국어 이름과 발음을 직접 편집하지 못하므로 아래의 조직 범위 사용자 정의 필드로 저장합니다.

| Discord 역할 | key와 표시 이름 | 설정 |
|---|---|---|
| `@국가의회의장` | `chairperson`, 국가의회의장 | `office, one, true, 0` |
| `@국가의회의원` | `member`, 국가의회의원 | `membership, many, false, 10` |

**구성원 분류 → 분류 만들기**에서 입력합니다.

```text
key: party
이름: 정당
기준 역할 연결 key: member
exclusive, allow_unassigned: true, false
```

분류를 연 뒤 **선택지 추가**에서 `@무소속`을 고르고 `independent`, `무소속`, `0`을 입력합니다. 의원에게 `@국가의회의원`과 정확히 하나의 정당 역할을 함께 부여하세요.

**추가 정보 → 필드 만들기**에서 다음 필드를 만들고 값을 설정합니다. `organization`은 조직이 유지되는 동안 고정, `term`은 임기마다 바뀌는 값입니다.

| key | 표시 이름 | 범위 / 형식 | 값 |
|---|---|---|---|
| `foreign_name` | 외국어 이름 | `organization` / `text` | `Reichstag` |
| `pronunciation` | 발음 | `organization` / `text` | `라이히스탁` |
| `seat_capacity` | 의석 정원 | `organization` / `number` | `5` |
| `founded_at` | 설립일 | `organization` / `date` | `2026-08-02` |
| `residence` | 관저 | `organization` / `text` | `국회의사당` |
| `election` | 선출 | `term` / `text` | `독일 신민` |
| `status` | 지위 | `term` / `text` | `독일 제국의 하원` |
| `ruling_party` | 여당 | `term` / `text` | `없음` |
| `predecessor` | 역대 제국의회 | `organization` / `text` | `제헌 제국의회(캉비츠)` |

먼저 `/term start organization:국가의회 name:제헌 국가의회 start_at:2026-08-02T00:00:00+09:00`을 실행한 뒤 임기 범위 필드 값을 넣습니다.

전체 템플릿:

```liquid
# <:Wappen_RT:1534363569741762600>
# {{ organization.name }}
**{{ fields.foreign_name | default: "Reichstag" }}**
-# {{ fields.pronunciation | default: "라이히스탁" }}

{% if term %}## {{ term.name }}
({{ term.startDate | date_short }}~){% else %}## 현재 임기 없음{% endif %}
{% assign party = classifications.party %}
정당:
{% for group in party.groups %} ― <:Wappen:1533303177791799417> `{{ group.displayName }}` {% if party.capacity %}`{{ group.count }}/{{ party.capacity }}` `{{ group.capacityPercentage | percentage: 1 }}`{% else %}`{{ group.count }}명`{% endif %}
{% endfor %}
구성 | {{ term.startDate | date_long }}
임기 | {% if term.scheduledEndDate %}{{ term.scheduledEndDate | date_long }}까지{% else %}미정(무기한){% endif %}
선출 | {{ fields.election | default: "미정" }}
지위 | {{ fields.status | default: "미정" }}
설립 | {{ fields.founded_at | date_long | default: "미정" }}
관저 | {{ fields.residence | default: "미정" }}
여당 | `{{ fields.ruling_party | default: "없음" }}`
역대 제국의회 | {{ fields.predecessor | default: "없음" }}
```

게시 설정은 `#국가의회-현황`, 이름 `국가의회 현황`, 자동 갱신 켜기입니다.

> [!IMPORTANT]
> 현재 공개 패널은 `seat_capacity`를 정당 분류의 정원 필드에 연결하지 못합니다. 새로 만든 분류에서 `party.capacity`와 `group.capacityPercentage`는 비어 있으므로 정당 줄은 `무소속 6명`으로 표시됩니다. 아래 목표 출력은 이 연결이 이미 존재하는 이전 데이터에서만 나옵니다. 운영 DB를 직접 편집하는 우회 절차는 지원하지 않습니다.

정원 연결이 있는 데이터에서 의원 6명이 모두 무소속이면 예상 출력은 다음과 같습니다.

```text
# <:Wappen_RT:1534363569741762600>
# 국가의회
**Reichstag**
-# 라이히스탁

## 제헌 국가의회
(26.08.02~)
정당:
 ― <:Wappen:1533303177791799417> `무소속` `6/5` `120.0%`

구성 | 2026년 08월 02일
임기 | 미정(무기한)
선출 | 독일 신민
지위 | 독일 제국의 하원
설립 | 2026년 08월 02일
관저 | 국회의사당
여당 | `없음`
역대 제국의회 | 제헌 제국의회(캉비츠)
```

### 포럼 게시물

이 예시는 학생회 현황을 `#학생회-공고` 포럼에 게시합니다.

| 항목 | 설정 |
|---|---|
| 필요한 역할 | `@학생회장`, `@학생회`, 선택 분류용 `@집행부` |
| 조직 생성 | `학생회 포럼`, key `student_council_forum` |
| 역할 연결 | `@학생회장` → `president`, 직책·1명·필수 |
| 역할 연결 | `@학생회` → `member`, 구성원·여러 명 |
| 분류 | `team`, 팀, 기준 `member`; `executive` → 집행부 → `@집행부` |
| 사용자 정의 필드 | `location`, 회의실, `organization` / `text`, `학생회실` |
| 임기 | `2026 학생회`, 시작 `2026-03-01T00:00:00+09:00` |

전체 본문 템플릿:

```liquid
# {{ organization.name }}
{% if term %}**{{ term.name }}** · {{ term.startDate | date_long }} 시작{% endif %}
학생회장 | {{ roles.president.joinedMentions | default: "공석" }}
구성원 | {{ roles.member.count | number }}명
회의실 | {{ fields.location | default: "미정" }}
{% for group in classifications.team.groups %}{{ group.displayName }} | {{ group.count | number }}명
{% endfor %}
```

`/publication create organization:학생회 포럼 channel:#학생회-공고 name:학생회 포럼 현황 auto_refresh:True`를 실행하고 이 템플릿을 고릅니다. 게시물 패널에서 설정합니다.

```text
스레드 설정 → 제목 Liquid 템플릿: {{ organization.name }} · {{ term.name | default: "현재 임기 없음" }}
제목과 태그 → 공지, 현황
자동 보관: 1440
slowmode: 0
flags: preserve_manual_tags
```

- 자동 보관은 `60`, `1440`, `4320`, `10080`분 중 하나입니다.
- slowmode는 `0`~`21600`초입니다.
- `preserve_manual_tags`는 관리자가 Discord에서 나중에 붙인 태그를 자동 갱신 때 보존합니다.
- `archive`를 flags에 넣으면 게시·갱신 후 다시 보관합니다. 봇에는 Manage Threads 권한이 필요합니다.
- `lock`은 게시 후 잠급니다. 잠긴 thread는 이후 자동 갱신할 수 없으므로 **자동 갱신과 함께 사용하지 마세요**. 다시 갱신하려면 Discord에서 잠금을 풀고 설정에서도 `lock`을 제거합니다.

**미리보기 → 저장하고 게시**를 누르면 제목이 `학생회 포럼 · 2026 학생회`인 thread와 다음 starter message가 생성됩니다.

```text
# 학생회 포럼
2026 학생회 · 2026년 03월 01일 시작
학생회장 | @김민지
구성원 | 4명
회의실 | 학생회실
집행부 | 2명
```

## 자주 생기는 문제

### 봇이 오프라인

1. `node --version`이 22 이상인지 확인합니다.
2. `.env`의 토큰과 Server Members Intent를 확인합니다.
3. `npm run dev`를 다시 실행하고 `Discord bot ready` 로그를 찾습니다.

### 슬래시 명령이 없음

1. `DISCORD_CLIENT_ID`와 개발 서버 ID를 확인합니다.
2. `npm run commands:register`를 다시 실행합니다.
3. 초대 scope에 `applications.commands`가 있는지 확인합니다.

### 패널이 만료됨

1. 패널을 연 본인인지, **서버 관리** 권한이 있는지 확인합니다.
2. `/org manage`, `/template manage` 또는 `/publication manage`를 다시 실행합니다.

### 템플릿 렌더링 실패

1. `/template preview`에서 오류와 길이를 확인합니다.
2. 최소 템플릿으로 줄여 변수·필터 철자와 닫는 `endif`/`endfor`를 확인합니다.
3. 결과를 2,000자 이하로 줄이고 임의 멘션을 제거합니다.

### 게시물이 갱신되지 않음

1. `/publication manage`에서 자동 갱신과 마지막 오류를 확인합니다.
2. **지금 갱신** 또는 `/publication refresh`를 실행합니다.
3. `/diagnose`로 삭제된 역할·채널과 포럼 잠금을 확인합니다.

### 메시지나 포럼 thread를 삭제함

1. `/publication manage`에서 해당 게시물을 엽니다.
2. **연결 복구 → 대체 게시물 만들기**를 누릅니다.
3. 채널 자체가 삭제됐다면 새 채널에 새 게시 설정을 만듭니다.

자세한 권한, 태그, SQLite, native module과 진단 코드별 해결법은 [문제 해결 가이드](docs/TROUBLESHOOTING.md)에 있습니다.

## 현재 제한사항

- 조직 목록 버튼은 처음 5개, 역할·분류와 일부 선택 화면은 처음 25개만 표시합니다. 템플릿·게시물 목록만 이전/다음 페이지를 지원합니다.
- 조직의 외국어 이름·발음, 분류의 정원 필드·미분류 이름, 서버 시간대·관리자 역할은 현재 공개 패널에서 편집할 수 없습니다.
- 역할·채널 형식의 사용자 정의 필드는 선택기가 없어 값을 넣으려면 Discord ID가 필요합니다.
- 임기 시작 후 이름·날짜 편집과 게시 대상 채널 변경 화면이 없습니다.
- 일부 설정 변경과 수동 임기 상태 변경은 즉시 자동 갱신 대기열에 들어가지 않습니다. 변경 후 **지금 갱신**을 사용하세요.
- 본문은 2,000자를 넘으면 자동 분할하지 않고 실패합니다. 포럼 제목은 렌더 후 100자로 잘립니다.
- 잠긴 포럼 thread는 자동 갱신할 수 없습니다.

## 상세 문서

- [Liquid 변수·필터와 작성법](docs/TEMPLATE_GUIDE.md)
- [권한·포럼·SQLite·진단 문제 해결](docs/TROUBLESHOOTING.md)
- [구조·DB·호환성과 개발 제한](docs/DEVELOPMENT.md)

## 개발자 참고

변경 후 다음 세 명령을 실행하세요.

```bash
npm run typecheck
npm test
npm run build
```
