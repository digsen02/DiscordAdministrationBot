# Discord Organization Manager

Discord 서버의 역할을 기반으로 조직 구성원, 직책, 분류, 임기 정보를 계산하고 이를 하나의 게시 메시지로 유지하는 관리 봇입니다.

예를 들어 학생회, 운영진, 동아리, 길드처럼 구성원이 Discord 역할로 구분되는 조직을 등록한 뒤 다음 작업을 할 수 있습니다.

- `회장`, `부회장`, `운영진` 같은 Discord 역할과 조직의 직책을 연결
- 구성원을 부서, 기수, 팀 등의 기준으로 자동 분류
- 임기의 시작, 종료, 중지, 재개와 과거 임기 기록 관리
- 정원, 연락처, 슬로건 같은 조직별 사용자 정의 정보 저장
- Liquid 템플릿으로 조직 현황 게시물 작성
- 역할이나 임기가 바뀌면 기존 게시 메시지를 자동 갱신
- 누락된 필수 역할, 중복 직책, 삭제된 역할, 손상된 게시물 진단

> 이 봇은 Discord 역할을 부여하거나 회수하지 않습니다. 서버에 이미 설정된 역할과 그 역할의 보유자를 읽어 조직 현황을 계산합니다.

## 사용 흐름

봇은 다음 순서로 설정합니다.

1. Discord Developer Portal에서 봇을 만들고 서버에 초대합니다.
2. 슬래시 명령어를 테스트 서버에 등록하고 봇을 실행합니다.
3. `/org create`로 관리할 조직을 만듭니다.
4. `/org-role add`로 Discord 역할을 조직의 직책 또는 구성원 역할과 연결합니다.
5. 필요하면 사용자 정의 필드, 분류와 임기를 설정합니다.
6. `/template create` 또는 `/template import`로 게시 형식을 만듭니다.
7. `/publication create`와 `/publication publish`로 게시물을 생성합니다.
8. 이후 Discord 역할이나 임기 정보가 변경되면 같은 메시지가 자동으로 갱신됩니다.

## 요구 사항

- Node.js 22 이상
- Discord 애플리케이션과 봇 토큰
- 봇을 테스트할 Discord 서버
- 봇이 읽을 수 있는 서버 역할과 게시 채널
- 로컬 SQLite 파일을 저장할 수 있는 디렉터리

## 1. Discord 봇 준비

### 애플리케이션과 봇 생성

1. [Discord Developer Portal](https://discord.com/developers/applications)에서 애플리케이션을 생성합니다.
2. `Bot` 메뉴에서 봇을 생성합니다.
3. `Reset Token` 또는 `Copy`로 봇 토큰을 확인합니다.
4. `Privileged Gateway Intents`에서 **Server Members Intent**를 켭니다.

`Server Members Intent`는 전체 구성원과 역할 변경 이벤트를 읽는 데 필요합니다. 켜지 않으면 실행 중 `Used disallowed intents` 오류가 발생합니다.

봇 토큰은 비밀번호와 같습니다. 채팅, 로그, Git 저장소에 노출했다면 즉시 `Reset Token`으로 재발급하세요.

### 봇을 서버에 초대

Developer Portal의 `OAuth2` → `URL Generator`에서 다음 scope를 선택합니다.

- `bot`
- `applications.commands`

최소 권한은 다음과 같습니다.

- View Channels
- Send Messages
- Read Message History

생성된 URL로 봇을 테스트 서버에 초대합니다. Discord 클라이언트의 개발자 모드는 서버 ID를 복사할 때만 필요합니다.

### 서버 ID 복사

테스트 서버에만 명령어를 즉시 등록하려면 서버 ID가 필요합니다.

1. Discord 사용자 설정 → `고급` → `개발자 모드`를 켭니다.
2. 서버 아이콘을 우클릭합니다.
3. `서버 ID 복사`를 선택합니다.

## 2. 설치 및 환경 설정

PowerShell에서 프로젝트 디렉터리로 이동한 뒤 실행합니다.

```powershell
npm install
Copy-Item .env.example .env
```

`.env`를 열어 다음 값을 입력합니다.

```dotenv
DISCORD_TOKEN=새로_발급한_봇_토큰
DISCORD_CLIENT_ID=Discord_애플리케이션_ID
DISCORD_DEV_GUILD_ID=테스트_서버_ID
DATABASE_URL=./data/bot.db
LOG_LEVEL=info
```

| 환경 변수 | 필수 | 설명 |
|---|---:|---|
| `DISCORD_TOKEN` | 예 | Developer Portal에서 발급한 봇 토큰 |
| `DISCORD_CLIENT_ID` | 예 | Developer Portal의 Application ID |
| `DISCORD_DEV_GUILD_ID` | 아니요 | 입력하면 해당 서버에만 명령어를 즉시 등록하며, 비우면 글로벌 명령어로 등록 |
| `DATABASE_URL` | 아니요 | SQLite 파일 경로. 기본값은 `./data/bot.db` |
| `LOG_LEVEL` | 아니요 | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` 중 하나 |

`.env`는 `.gitignore`에 포함되어 있으며 저장소에 커밋하면 안 됩니다.

## 3. 데이터베이스와 명령어 준비

데이터베이스 마이그레이션을 적용합니다.

```powershell
npm run db:migrate
```

슬래시 명령어를 등록합니다.

```powershell
npm run commands:register
```

`DISCORD_DEV_GUILD_ID`가 설정되어 있으면 해당 테스트 서버에만 등록되어 거의 즉시 나타납니다. 값을 비우면 글로벌 명령어로 등록되며 Discord 전체에 반영되기까지 시간이 걸릴 수 있습니다.

> 현재 `commands:register` 실행 시 `DISCORD_TOKEN`이 `undefined`라는 오류가 발생하면 명령 등록 진입점에서 `.env`를 불러오지 못한 것입니다. `src/infrastructure/discord/register-commands.ts`에서 `loadConfig()`보다 먼저 `.env`를 로드해야 합니다.

## 4. 봇 실행

개발 중에는 다음 명령을 사용합니다.

```powershell
npm run dev
```

터미널에 `Discord bot ready` 로그가 나타나고 Discord에서 봇이 온라인이면 준비된 상태입니다. `tsx watch`를 사용하므로 소스가 변경되면 자동으로 다시 시작됩니다.

운영 빌드는 다음 순서로 실행합니다.

```powershell
npm run build
npm start
```

## 빠른 사용 예시

다음 예시는 `학생회` 조직을 만들고 회장과 운영진 현황을 게시하는 과정입니다. 슬래시 명령어를 입력하면 Discord가 각 옵션 입력란을 표시하므로 아래 값을 해당 입력란에 선택하거나 입력하면 됩니다.

### 1단계: 조직 생성

```text
/org create
key: council
name: 학생회
description: 서버 학생회 조직
```

`key`는 이후 다른 명령에서 조직을 찾을 때 사용하는 내부 키입니다. 영문 소문자, 숫자, `_`, `-`를 사용한 짧고 변경되지 않는 값을 권장합니다.

### 2단계: Discord 역할 연결

회장은 한 명이어야 하고 필수 직책이라고 설정합니다.

```text
/org-role add
organization: council
key: president
display_name: 회장
role: @회장
kind: office
cardinality: one
required: true
display_order: 1
```

전체 운영진 역할도 연결합니다.

```text
/org-role add
organization: council
key: member
display_name: 운영진
role: @운영진
kind: membership
cardinality: many
required: false
display_order: 2
```

- `kind=office`: 회장, 부회장처럼 직책으로 사용하는 연결
- `kind=membership`: 운영진, 회원처럼 소속을 나타내는 연결
- `cardinality=one`: 보유자가 2명 이상이면 진단 경고
- `cardinality=many`: 여러 명이 보유할 수 있음
- `required=true`: 보유자가 없으면 진단 경고

봇은 역할 자체를 변경하지 않습니다. `@회장` 역할을 다른 사용자에게 부여하면 봇이 새 보유자를 자동으로 계산합니다.

### 3단계: 임기 시작

```text
/term start
organization: council
name: 2026년 학생회
number: 1
start_at: 2026-03-01T00:00:00+09:00
scheduled_end_at: 2027-02-28T23:59:59+09:00
close_current: false
```

날짜와 시각은 ISO 8601 형식으로 입력합니다. 예정 종료 시각이 지나면 스케줄러가 활성 임기를 자동 종료합니다.

### 4단계: 템플릿 생성

짧은 템플릿은 `/template create`의 `content`를 비운 채 실행하면 입력 창이 열립니다.

```text
/template create
organization: council
name: 조직 현황
draft: false
```

입력 창에 다음과 같은 Liquid 템플릿을 작성합니다.

```liquid
# {{ organization.name }}
{% if term %}
**현재 임기:** {{ term.name }}
**시작일:** {{ term.startDate | date_long }}
{% endif %}

**회장:** {{ roles.president.joinedMentions | default: "공석" }}
**운영진:** {{ roles.member.joinedMentions | default: "없음" }}
**운영진 수:** {{ roles.member.count | number }}명

{% if warnings.size > 0 %}
## 확인 필요
{% for warning in warnings %}
- {{ warning }}
{% endfor %}
{% endif %}
```

긴 템플릿은 UTF-8 `.txt` 파일로 만든 뒤 `/template import`로 가져올 수 있습니다. 파일 크기는 100KB 이하여야 합니다.

### 5단계: 게시 설정 생성 및 최초 게시

```text
/publication create
organization: council
name: 학생회 안내
template: 조직 현황
channel: #조직-안내
auto_refresh: true
```

명령 결과에 `게시 설정 #3`처럼 ID가 표시됩니다. 이 ID를 사용해 최초 메시지를 게시합니다.

```text
/publication publish publication_id:3
```

이후 `@회장` 또는 `@운영진` 역할 보유자가 변경되면 약 5초 동안 변경을 모은 뒤 같은 Discord 메시지를 수정합니다.

## 핵심 개념

### 조직

조직은 모든 설정의 최상위 단위입니다. 한 Discord 서버에 여러 조직을 만들 수 있으며 `organization` 옵션에는 조직 생성 시 정한 내부 키를 입력합니다.

### 역할 연결

Discord 역할과 템플릿 내부 키를 연결합니다. 연결된 역할의 보유자 수, 이름, 멘션과 설정 오류가 자동 계산됩니다.

### 사용자 정의 필드

Discord 역할만으로 표현하기 어려운 값을 저장합니다.

- 범위: `organization` 또는 `term`
- 형식: `text`, `multiline_text`, `number`, `date`, `datetime`, `boolean`, `select`, `role`, `channel`
- 예시: 정원, 슬로건, 공식 채널, 문의 역할, 임기별 공약

필드를 먼저 정의한 뒤 값을 설정합니다.

```text
/org-field add
organization: council
key: capacity
label: 정원
scope: organization
type: number
required: true
default_value: 20
```

```text
/org-field set organization:council key:capacity value:25
```

`term` 범위 필드는 `/term history` 또는 `/term show`에서 확인한 `term_id`가 필요합니다. `role`과 `channel` 형식은 각각 `role_value`, `channel_value` 선택기를 사용합니다.

### 분류

기준 역할을 가진 사용자들을 추가 Discord 역할에 따라 그룹화합니다. 예를 들어 `@운영진` 구성원을 `@기획팀`, `@홍보팀`으로 나눌 수 있습니다.

```text
/classification create
organization: council
key: department
display_name: 부서
base_role_key: member
exclusive: true
allow_unassigned: false
unassigned_label: 미배정
capacity_field_key: capacity
```

```text
/classification-option add
organization: council
classification: department
key: planning
display_name: 기획팀
role: @기획팀
display_order: 1
```

`exclusive=true`인데 한 사용자가 여러 선택지 역할을 가지고 있거나, `allow_unassigned=false`인데 어떤 선택지에도 속하지 않으면 진단 경고가 생성됩니다.

### 임기

조직마다 활성 임기는 하나만 둘 수 있습니다.

- `/term start`: 새 임기 시작
- `/term edit`: 임기 이름 또는 예정 종료 시각 수정
- `/term suspend`: 활성 임기 일시 중지
- `/term resume`: 중지된 임기 재개
- `/term end`: 정상 종료
- `/term dissolve`: 해산 처리
- `/term show`: 현재 활성 임기 확인
- `/term history`: 전체 임기 기록 확인

새 임기를 시작할 때 활성 임기가 이미 있다면 `close_current=true`로 기존 임기를 종료할 수 있습니다. 필수 임기 필드는 `field_values`에 `key=value;key=value` 형식으로 전달할 수 있습니다.

### 템플릿과 게시 설정

템플릿은 메시지의 모양이고 게시 설정은 “어떤 템플릿을 어느 채널의 어떤 메시지에 적용할지”를 저장합니다.

- 템플릿 초안은 저장할 수 있지만 게시에는 사용할 수 없습니다.
- `/template preview`는 메시지를 게시하지 않고 렌더링 결과만 확인합니다.
- `/publication publish`는 최초 메시지를 생성합니다.
- `/publication refresh`는 기존 메시지를 즉시 다시 계산합니다.
- `/publication repair`는 기존 메시지가 삭제됐을 때 새 메시지를 만들고 연결합니다.
- 게시 설정을 삭제해도 이미 게시된 Discord 메시지는 남습니다.

## 템플릿 작성법

Liquid의 변수, `if`, `for`, `default` 필터를 사용할 수 있습니다.

### 사용할 수 있는 최상위 변수

| 변수 | 내용 |
|---|---|
| `organization` | `key`, `name`, `foreignName`, `pronunciation`, `description` |
| `term` | 활성 임기의 `number`, `name`, `status`, `startDate`, `scheduledEndDate`, `actualEndDate`, `endReason` |
| `fields` | `/org-field`로 저장한 값을 필드 키로 조회 |
| `roles` | 역할 연결별 보유자와 진단 상태 |
| `classifications` | 분류별 인원, 비율, 그룹, 미분류 인원과 경고 |
| `history.terms` | 과거 및 현재 임기 배열 |
| `warnings` | 누락, 중복, 역할 삭제, 분류 오류 등의 경고 배열 |

### 역할 연결 값

`roles.<역할키>`에서 다음 값을 사용할 수 있습니다.

| 속성 | 설명 |
|---|---|
| `displayName` | 역할 연결 표시 이름 |
| `roleId` | Discord 역할 ID |
| `count` | 역할 보유자 수 |
| `names` | 표시 이름 배열 |
| `mentions` | 사용자 멘션 배열 |
| `joinedNames` | 이름을 쉼표로 연결한 문자열 |
| `joinedMentions` | 멘션을 쉼표로 연결한 문자열 |
| `vacant` | 보유자가 없으면 `true` |
| `valid` | 필수 인원과 단일 보유 조건이 정상이면 `true` |
| `broken` | 연결된 Discord 역할을 찾을 수 없으면 `true` |
| `warnings` | 해당 연결의 경고 배열 |

### 분류 값 예시

```liquid
{% assign department = classifications.department %}
전체 {{ department.population }}명

{% for group in department.groups %}
- {{ group.displayName }}: {{ group.count }}명
  - 전체 대비 {{ group.populationPercentage | percentage }}
  - 구성원: {{ group.memberMentions | join_values: ", " | default: "없음" }}
{% endfor %}
```

분류에는 `population`, `capacity`, `overflow`, `unassignedCount`, `unassignedNames`, `warnings`, `groups`가 포함됩니다. 각 그룹에는 `key`, `displayName`, `roleId`, `roleMention`, `count`, `populationPercentage`, `capacityPercentage`, `memberNames`, `memberMentions`가 포함됩니다.

### 추가 필터

| 필터 | 예시 | 결과 |
|---|---|---|
| `date_short` | `{{ term.startDate \| date_short }}` | `26.03.01` |
| `date_long` | `{{ term.startDate \| date_long }}` | `2026년 03월 01일` |
| `date_time` | `{{ term.startDate \| date_time }}` | `2026년 03월 01일 00:00` |
| `percentage` | `{{ value \| percentage: 1 }}` | `25.0%` |
| `number` | `{{ value \| number }}` | `1,000` |
| `join_values` | `{{ names \| join_values: ", " }}` | 배열을 문자열로 연결 |
| `role_mention` | `{{ role_id \| role_mention }}` | 역할 멘션 생성 |
| `user_mention` | `{{ user_id \| user_mention }}` | 사용자 멘션 생성 |

보안을 위해 다음 제약이 적용됩니다.

- `include`, `render`, `layout`과 파일 로딩은 사용할 수 없음
- `@everyone`, `@here` 사용 불가
- 저장된 역할이나 실제 역할 보유자가 아닌 임의 멘션 사용 불가
- 렌더링 결과가 Discord 메시지 제한인 2,000자를 넘으면 게시하지 않음

## 명령어 요약

| 명령어 | 기능 |
|---|---|
| `/org create`, `edit`, `show`, `list`, `delete` | 조직 생성 및 관리 |
| `/org inspect` | 누락된 역할, 중복 보유자, 손상 게시물 등 진단 |
| `/org config` | 서버 시간대, locale, 봇 관리자 역할 설정 |
| `/org-role add`, `edit`, `remove`, `list` | Discord 역할 연결 관리 |
| `/org-field add`, `edit`, `remove`, `list`, `set` | 사용자 정의 필드 관리 |
| `/classification create`, `edit`, `remove`, `list` | 역할 기반 분류 관리 |
| `/classification-option add`, `edit`, `remove` | 분류에 사용할 Discord 역할 관리 |
| `/term start`, `edit`, `end`, `dissolve`, `suspend`, `resume` | 임기 상태 관리 |
| `/term show`, `history` | 현재 임기와 임기 기록 확인 |
| `/template create`, `edit`, `import`, `preview`, `show`, `list`, `delete` | Liquid 템플릿 관리 |
| `/publication create`, `publish`, `preview`, `refresh`, `repair`, `list`, `delete` | 게시 메시지 관리 |

모든 관리 명령의 응답은 명령 실행자에게만 보이는 ephemeral 메시지입니다. 삭제 명령은 확인 버튼을 표시하며 5분 후 만료됩니다.

## 관리자 권한

명령 사용자는 다음 중 하나를 만족해야 합니다.

- Discord의 `Manage Server` 권한 보유
- `/org config`에서 지정한 봇 관리자 역할 보유

처음에는 `Manage Server` 권한이 있는 사용자가 설정해야 합니다.

```text
/org config
time_zone: Asia/Seoul
locale: ko-KR
administrator_role: @조직관리자
```

## 자동 갱신

`auto_refresh=true`인 게시물은 다음 상황에서 갱신 대상이 됩니다.

- 연결된 Discord 역할의 보유자가 변경됨
- 연결된 역할 또는 분류 역할의 이름이 변경됨
- 사용자 정의 필드가 변경됨
- 임기가 시작, 종료, 중지 또는 재개됨
- 템플릿이 변경됨
- 봇이 다시 시작됨

짧은 시간에 여러 변경이 발생하면 5초 동안 하나로 합쳐 Discord API 요청을 줄입니다. 임기 스케줄러는 매분 종료 예정 시각이 지난 활성 임기를 확인합니다.

## 진단과 문제 해결

### 명령어가 보이지 않음

1. 봇을 초대할 때 `applications.commands` scope를 선택했는지 확인합니다.
2. `.env`의 `DISCORD_CLIENT_ID`와 `DISCORD_DEV_GUILD_ID`를 확인합니다.
3. `npm run commands:register`를 다시 실행합니다.
4. Discord 클라이언트를 `Ctrl+R`로 새로고침합니다.

### `DISCORD_TOKEN` 또는 `DISCORD_CLIENT_ID`가 `undefined`

실행 진입점이 `.env`를 불러오기 전에 환경 설정을 검사한 상태입니다. `.env`가 프로젝트 루트에 있는지 확인하고, 명령 등록 진입점이 `loadConfig()` 전에 `.env`를 로드하도록 구성합니다.

### `Used disallowed intents`

Developer Portal → 애플리케이션 → `Bot` → `Privileged Gateway Intents`에서 **Server Members Intent**를 켜고 봇을 다시 시작합니다.

### 역할 보유자가 집계되지 않음

- Server Members Intent가 켜져 있는지 확인합니다.
- 봇이 대상 서버에 접속되어 있는지 확인합니다.
- `/org-role list`에서 올바른 역할이 연결됐는지 확인합니다.
- `/org inspect organization:<조직키>`를 실행합니다.

### 게시물이 갱신되지 않음

- `/publication list organization:<조직키>`에서 게시 설정 ID와 손상 여부를 확인합니다.
- `/publication refresh publication_id:<ID>`로 수동 갱신을 시도합니다.
- 봇이 대상 채널을 보고 메시지를 보내며 기록을 읽을 수 있는지 확인합니다.
- 템플릿 결과가 2,000자를 넘지 않는지 확인합니다.

### 게시 메시지를 삭제함

```text
/publication repair publication_id:<ID>
```

새 메시지를 만들고 게시 설정에 새 메시지 ID를 저장합니다.

### 오류 메시지에 문의 코드가 표시됨

터미널 로그에서 같은 correlation ID를 검색하면 내부 오류를 확인할 수 있습니다. 사용자에게는 내부 스택 대신 한국어 안내와 문의 코드만 표시됩니다.

### `better-sqlite3` 설치 실패

Node.js 22 이상을 사용하고, 사용하는 Node.js 버전에 맞는 네이티브 바이너리가 없을 경우 Windows C++ 빌드 도구가 설치되어 있는지 확인합니다.

## 데이터와 운영

- 기본 데이터베이스는 `./data/bot.db`입니다.
- SQLite는 WAL 모드와 5초 busy timeout을 사용합니다.
- `.env`, `data`, `*.db`, 로그 파일은 Git에서 제외됩니다.
- 조직을 삭제해도 임기와 감사 기록은 보존됩니다.
- 게시 설정을 삭제해도 Discord에 이미 작성된 메시지는 보존됩니다.
- 하나의 SQLite 파일을 여러 서버의 봇 프로세스가 동시에 공유하지 마세요.
- 운영 환경에서는 `data` 디렉터리를 영속 볼륨에 두고 토큰은 secret 저장소로 관리하는 것을 권장합니다.

운영 실행 예시:

```powershell
npm ci
npm run db:migrate
npm run commands:register
npm run build
npm start
```

## 개발 명령

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

새 DB 마이그레이션을 생성하고 적용하려면 다음을 실행합니다.

```powershell
npm run db:generate
npm run db:migrate
```

개발용 예시 데이터가 필요하면 다음 명령을 사용할 수 있습니다. 시드에 포함된 Discord ID는 가짜 값이므로 실제 운영 설정으로 사용할 수 없습니다.

```powershell
npm run db:seed
```

## 프로젝트 구조

- `src/domain`: 역할 해석, 분류 계산, 필드 검증, 임기 상태 전이
- `src/app`: 권한, 조직, 게시 및 템플릿 컨텍스트 서비스
- `src/infrastructure/database`: Drizzle ORM과 SQLite 스키마 및 마이그레이션
- `src/infrastructure/discord`: 슬래시 명령어, 상호작용과 Discord 이벤트 처리
- `src/infrastructure/template`: Liquid 렌더링 및 멘션·길이 검증
- `src/infrastructure/scheduler`: 게시물 갱신 큐와 임기 만료 스케줄러
- `tests`: Discord 연결 없이 실행되는 도메인 및 서비스 테스트

## 지원하지 않는 기능

현재 다음 기능은 포함하지 않습니다.

- 웹 관리 대시보드
- Discord 역할 자동 부여 또는 회수
- 투표, 선거, 출석, 입법 또는 특정 의사 절차
- 여러 메시지나 임베드로 나누는 장문 게시물

관리 UI는 Discord의 슬래시 명령어, 역할·채널 선택기, 모달, 선택 메뉴와 확인 버튼을 사용합니다.
