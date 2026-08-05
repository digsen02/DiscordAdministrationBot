# Discord Organization Manager

## 선택형 관리 UX

관리 화면은 사람이 읽을 수 있는 이름과 상태를 먼저 보여 주며, 데이터베이스 ID는 Discord 컴포넌트의 값과 라우팅에만 사용합니다. 관리자는 조직 키, 템플릿 ID, 게시물 ID, enum 값 또는 포럼 태그 ID를 외울 필요가 없습니다.

- `/org manage` → 조직 대시보드 → 영역 선택 → 목록 또는 상세 화면 → 작업 → **뒤로**
- `/template manage` → 선택적으로 조직 필터 → 템플릿 선택 → 상태·사용 현황 확인 → 미리보기 또는 수정
- `/publication create` → 조직과 채널 선택 → 게시 가능한 템플릿 선택 → 설정 확인 → 미리보기 → 게시
- `/publication manage` → 선택적으로 조직 필터 → 게시물 선택 → 연결 상태 확인 → 상황에 맞는 작업

`organization`, `/template preview`의 `template`, `/publication refresh`의 `publication` 옵션은 자동완성을 지원합니다. 검색 결과에는 이름과 상태가 표시되지만 저장과 상호작용에는 기존의 안정적인 키와 ID를 그대로 사용합니다. 템플릿과 게시물 목록은 한 페이지에 최대 25개를 표시하고 이전/다음 버튼으로 이동합니다.

조직 삭제는 첫 대시보드에 노출되지 않고 **고급 관리**에 있습니다. 게시물 복구는 연결이 끊어졌거나 렌더 오류가 있는 경우에만 표시되며, 자동 갱신 메뉴는 실행 결과가 **켜기** 또는 **끄기**인지 명시합니다. 이미 열린 v1 패널과 기존 데이터, 게시 메시지·스레드 연결은 계속 호환됩니다.

## 봇 소개

Discord Organization Manager는 서버에 이미 있는 Discord 역할을 읽어 조직의 직책, 구성원, 분류와 임기를 계산하고, 그 결과를 Liquid 템플릿으로 게시하는 관리 봇입니다. 학생회, 운영진, 동아리, 길드, 의회처럼 구성원이 역할로 구분되는 조직에 사용할 수 있습니다.

봇은 Discord 역할을 조직의 `office`(회장처럼 직책을 나타내는 역할) 또는 `membership`(회원처럼 소속을 나타내는 역할)에 연결합니다. 이후 역할 보유자 수, 이름과 멘션을 읽어 일반 채널의 메시지 하나 또는 포럼 채널의 thread 하나를 계속 갱신합니다.

> [!IMPORTANT]
> 이 봇은 Discord 역할을 부여하거나 회수하지 않습니다. 역할 변경은 Discord에서 관리자가 직접 수행해야 합니다. 봇은 변경된 역할과 보유자를 읽어 게시물에 반영합니다.

## 주요 기능

- 한 서버에서 여러 조직 관리
- 기존 Discord 역할을 직책 또는 구성원 역할로 연결
- `one`/`many`, 필수 여부와 표시 순서 설정
- 역할을 기준으로 구성원을 부서, 정당, 팀 같은 분류로 계산
- 조직 또는 임기 범위의 사용자 정의 필드 관리
- 임기 예약, 시작, 일시 중지, 재개, 종료와 이력 조회
- Liquid 템플릿 작성, UTF-8 파일 가져오기, 복제, 미리보기와 내보내기
- 일반 텍스트·공지 채널의 기존 메시지 하나 유지
- 포럼 채널의 thread, starter message, 제목, 태그와 thread 설정 유지
- 역할 변경, 예약 임기 전환, 봇 재시작 등에 따른 자동 갱신
- 삭제된 역할·채널·thread, 잘못된 분류 연결과 게시 실패 진단
- 삭제된 메시지 또는 thread의 복구·재연결

## 처음 사용하는 순서

1. **봇 설치** — 아래 설치 절차대로 봇을 초대하고 실행합니다. 터미널에 `Discord bot ready`가 나오고 Discord에서 봇이 온라인이어야 합니다.
2. **`/org create`** — 조직 이름과 내부 키를 입력합니다. 생성 직후 본인에게만 보이는 조직 관리 패널이 열립니다.
3. **`/org manage`에서 역할 연결** — **역할** → **추가**에서 Discord 역할을 고르고 내부 키와 규칙을 입력합니다. 저장하면 역할 목록에 연결이 표시됩니다.
4. **`/term start`** — 임기 이름과 선택적 시작·종료 시각을 입력합니다. 임기 패널에서 현재 상태와 일정이 표시됩니다.
5. **`/template create`** — 직접 입력, UTF-8 `.txt` 파일 또는 기존 템플릿 복제를 선택합니다. 저장 후 템플릿 관리 패널이 열립니다.
6. **`/publication create`** — 조직, 템플릿과 채널을 선택합니다. 채널 종류를 감지해 일반 또는 포럼 게시 관리 패널이 열립니다.
7. **미리보기** — 게시 패널의 **미리보기**로 본문 렌더링 결과와 길이·오류를 확인합니다.
8. **저장하고 게시** — 아직 게시하지 않은 설정에서 **저장하고 게시**를 누릅니다. 일반 채널에는 메시지가, 포럼에는 thread와 starter message가 생성됩니다.
9. **자동 갱신 확인** — 연결된 역할의 보유자를 바꿔 약 5초 뒤 같은 메시지 또는 thread가 수정되는지 확인합니다. 반영되지 않으면 `/publication refresh`와 `/diagnose`를 사용합니다.

> [!NOTE]
> `/publication create`를 실행하는 순간 게시 설정은 DB에 초안 상태로 저장됩니다. 별도의 **초안 저장** 버튼은 없습니다. **저장하고 게시**는 그 설정으로 Discord 콘텐츠를 처음 생성하는 버튼입니다.

## 설치

Node.js 22 이상과 npm이 필요합니다.

### Discord 봇 만들기

1. [Discord Developer Portal](https://discord.com/developers/applications)에서 **New Application**을 선택합니다.
2. 애플리케이션을 연 뒤 **Bot** 메뉴에서 봇을 만듭니다.
3. **Reset Token** 또는 **Copy**로 토큰을 확인합니다.
4. **Bot** → **Privileged Gateway Intents**에서 **Server Members Intent**를 켭니다.
5. **General Information**의 **Application ID**를 기록합니다.

> [!WARNING]
> 봇 토큰은 비밀번호입니다. 채팅, 로그 또는 Git 저장소에 노출했다면 Developer Portal에서 즉시 재발급하세요.

### 봇 초대하기

Developer Portal의 **OAuth2** → **URL Generator**에서 다음 scope를 선택합니다.

- `bot`
- `applications.commands`

아래 권한을 선택해 생성된 URL로 봇을 서버에 초대합니다. `Administrator` 권한은 필요하지 않습니다.

### 필요한 권한

| Discord 권한 | 필요한 이유 |
|---|---|
| View Channels | 대상 채널, 포럼과 thread를 찾고 읽기 위해 필요 |
| Send Messages | 일반 텍스트·공지 채널에 최초 메시지를 게시하기 위해 필요 |
| Send Messages in Threads | 포럼 thread의 starter message를 작성·수정하기 위해 필요 |
| Create Public Threads | 포럼 채널에 새 게시글(thread)을 만들기 위해 필요 |
| Manage Threads | 보관된 thread를 다시 열고 제목, 태그, 자동 보관, slowmode, 보관·잠금 상태를 바꾸기 위해 필요 |
| Read Message History | 저장된 message ID 또는 starter message를 다시 가져와 같은 메시지를 수정하기 위해 필요 |

`Manage Threads`는 포럼을 게시만 하고 끝낼 때보다 갱신할 때 특히 중요합니다. 제목·태그·thread 설정을 갱신하거나, 보관된 thread를 잠시 열었다가 다시 보관하려면 이 권한이 필요합니다.

관리 명령을 실행하는 사람은 Discord의 **Manage Server**(`ManageGuild`) 권한이 있거나 DB에 이미 설정된 봇 관리자 역할을 가지고 있어야 합니다. 현재 공개 명령에는 관리자 역할을 새로 지정하는 화면이 없으므로 새 설치에서는 **Manage Server** 권한을 사용합니다.

### 환경 변수 설정

프로젝트 폴더에서 다음을 실행합니다.

```powershell
npm install
Copy-Item .env.example .env
```

`.env`를 편집합니다.

```dotenv
DISCORD_TOKEN=봇_토큰
DISCORD_CLIENT_ID=애플리케이션_ID
DISCORD_DEV_GUILD_ID=개발_서버_ID
DATABASE_URL=./data/bot.db
LOG_LEVEL=info
```

| 변수 | 필수 | 기본값 | 설명 |
|---|---:|---|---|
| `DISCORD_TOKEN` | 예 | 없음 | Developer Portal의 봇 토큰 |
| `DISCORD_CLIENT_ID` | 예 | 없음 | 애플리케이션의 Application ID |
| `DISCORD_DEV_GUILD_ID` | 아니요 | 없음 | 설정하면 해당 서버에 guild command로 즉시 등록. 비우면 global command로 등록 |
| `DATABASE_URL` | 아니요 | `./data/bot.db` | SQLite 파일 경로 |
| `LOG_LEVEL` | 아니요 | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` 중 하나 |

개발 서버 ID는 Discord 사용자 설정 → **고급** → **개발자 모드**를 켠 뒤 서버 아이콘을 우클릭해 **서버 ID 복사**로 얻습니다.

### 데이터베이스 준비

```powershell
npm run db:migrate
```

기본 경로 `./data/bot.db`와 상위 디렉터리는 자동 생성됩니다. 봇 시작 시에도 미적용 migration이 자동 실행되지만, 업데이트 후에는 시작 전에 명시적으로 실행하는 편이 안전합니다.

> [!NOTE]
> `db:migrate` 스크립트는 `.env` 파일을 직접 읽지 않습니다. 기본값이 아닌 경로를 쓸 때는 같은 터미널에서 먼저 `$env:DATABASE_URL='D:\bot-data\bot.db'`처럼 설정한 뒤 migration을 실행하세요.

### 명령어 등록

```powershell
npm run commands:register
```

`DISCORD_DEV_GUILD_ID`가 있으면 해당 개발 서버에 즉시 등록합니다. 없으면 global command로 등록되며 Discord에 전파되는 데 시간이 걸릴 수 있습니다.

### 개발 모드 실행

```powershell
npm run dev
```

`tsx watch`가 소스 변경을 감지해 다시 시작합니다. `Discord bot ready` 로그가 나타나면 사용할 수 있습니다.

### 운영 모드 실행

```powershell
npm run build
npm start
```

## 기본 사용법

### 조직 만들기

```text
/org create name:학생회 key:council description:서버 학생회
```

`key`는 템플릿과 다른 명령에서 조직을 찾는 내부 식별자입니다. 영문 소문자로 시작하는 2~32자의 영문 소문자, 숫자와 밑줄만 사용할 수 있습니다. 만든 뒤 조직 관리 패널이 바로 열립니다.

### 조직 관리 패널

`/org manage organization:council`을 실행하면 ephemeral 패널이 열립니다. ephemeral은 명령 실행자에게만 보이는 Discord 응답입니다.

| 구역 | 실제 UI | 입력·관리 내용 | 저장 후 변화 |
|---|---|---|---|
| 기본 정보 | 메인 embed와 **기본 정보** 버튼 | 메인 embed에서 이름, 설명, key와 개수를 확인 | 현재 **기본 정보** 버튼에는 별도 편집 폼이 연결되어 있지 않음 |
| 역할 | 버튼 → role select menu → modal | Discord 역할, 내부 키, 표시 이름, `office\|membership`, `one\|many`, 필수 여부, 순서 | 역할 연결이 저장됨. 편집·제거 시 관련 자동 갱신 게시물을 queue에 추가 |
| 분류 | 버튼 → modal·select menu | 분류 key·이름·기준 역할 key·배타성·미분류 허용, 선택지 역할·순서 | 역할 기반 분류 계산과 게시 컨텍스트 변경 |
| 사용자 정의 필드 | 버튼 → modal·select menu | key, label, 범위, 형식, 필수 여부, 순서, select 값과 실제 값 | 조직 또는 현재 임기의 `fields.<key>` 값 변경 |
| 임기 | 버튼 → 임기 패널 | 현재 임기 확인, 일시 중지·재개·종료, 기록 | 임기 상태 변경 |
| 게시물 | 영역 선택 → 게시물 select menu | 이름, 채널, 게시 상태 확인 | 선택한 게시물의 상세 화면에서 계속 |
| 삭제 | Danger 버튼 → 확인 버튼 | 조직 삭제 확인 | 조직을 soft delete하여 공개 목록과 관리에서 숨김 |

> [!WARNING]
> 조직 **삭제 확인**은 되돌리기 UI가 없습니다. 관련 DB 행은 즉시 초기화되지 않지만 공개 명령에서 조직을 더 이상 찾을 수 없습니다. 먼저 DB를 백업하세요.

패널에는 실행자 ID가 들어간 버전형 custom ID가 사용됩니다. 다른 관리자는 같은 패널을 대신 누를 수 없습니다. 버튼·select menu·modal을 누를 때마다 다음을 다시 확인합니다.

- 패널 소유자가 현재 사용자와 같은지
- 사용자가 여전히 **Manage Server** 또는 설정된 관리자 역할을 갖는지
- 조직·템플릿·게시 설정이 같은 서버에 속하고 삭제되지 않았는지
- 임시 입력 session이 만료되지 않았는지

봇 재시작, session 만료, 대상 삭제, 권한 변경 또는 잘못된 custom ID로 오래된 패널이 동작하지 않으면 관련 `manage` 명령을 다시 실행합니다.

목록과 select menu는 Discord 제한에 맞춰 한 번에 최대 25개를 사용합니다. 현재 UI는 일부 목록의 첫 페이지만 표시하며 다음·이전 페이지 버튼은 제공하지 않습니다. `/org list`는 처음 5개 조직만 관리 버튼으로 표시합니다.

삭제·제거·임기 종료에는 별도 확인 버튼이 있습니다. 취소하거나 패널을 다시 열려면 `/org manage`, `/term manage`, `/template manage`, `/publication manage`를 다시 실행하면 됩니다.

### Discord 역할 연결하기

1. `/org manage organization:council` → **역할** → **추가**를 누릅니다.
2. role select menu에서 기존 Discord 역할을 선택합니다.
3. modal에 다음처럼 입력합니다.

```text
내부 키: president
표시 이름: 회장
종류, 개수, 필수, 순서: office, one, true, 0
```

구성원 역할 예시:

```text
내부 키: member
표시 이름: 운영진
종류, 개수, 필수, 순서: membership, many, false, 10
```

`one` 역할에 여러 명이 있거나 필수 역할이 공석이면 `warnings`와 역할별 `warnings`에 경고가 생깁니다. 연결을 제거해도 실제 Discord 역할은 삭제되지 않습니다.

### 분류 만들기

분류는 기준 역할 보유자를 다른 역할들로 그룹화합니다. 예를 들어 `member` 역할 보유자를 기획부·홍보부로 나눌 수 있습니다.

1. **분류** → **분류 만들기**를 누릅니다.
2. `key`, 표시 이름, 기준 역할 연결 key를 입력합니다.
3. `exclusive, allow_unassigned`에 `true, false`처럼 입력합니다.
4. **선택지 관리**에서 분류를 고르고 각 Discord 역할을 추가합니다.

`exclusive=true`이면 여러 선택지 역할을 가진 사람은 중복 경고가 생기고 어느 그룹에도 집계되지 않습니다. `allow_unassigned=false`이면 기준 역할은 있지만 선택지 역할이 없는 사람이 경고에 포함됩니다.

### 사용자 정의 필드 설정하기

역할만으로 표현하기 어려운 정원, 슬로건, 선출일과 공식 채널 등을 저장합니다.

| 설정 | 값 |
|---|---|
| 범위 | `organization` 또는 `term` |
| 형식 | `text`, `multiline_text`, `number`, `date`, `datetime`, `boolean`, `select`, `role`, `channel` |
| 설정 입력 | `필수, 순서, select 값` 형식. 예: `false, 0, 서울\|부산\|제주` |

필드 생성 후 **값 설정·지우기**에서 값을 입력합니다. `term` 범위는 현재 활성 임기가 있어야 합니다. `date`는 `YYYY-MM-DD`, `datetime`은 ISO 8601, `boolean`은 `true` 또는 `false`를 사용합니다. 현재 패널의 값 입력은 모든 형식을 텍스트 modal로 받으므로 `role`과 `channel`에는 Discord ID를 입력합니다.

### 임기 시작하고 관리하기

```text
/term start organization:council name:2026년 학생회 start_at:2026-03-01T00:00:00+09:00 scheduled_end_at:2027-02-28T23:59:59+09:00
```

- `start_at`을 생략하면 지금 시작합니다.
- 미래 시각이면 `scheduled`, 현재 또는 과거면 `active`로 저장됩니다.
- 조직마다 활성 임기는 하나만 둘 수 있습니다.
- scheduler가 1분마다 예약 시작과 예정 종료를 확인합니다.
- `/term manage`에서 일시 중지, 재개와 종료를 수행합니다.
- `/term history`에서 최근 임기 기록을 봅니다.

현재 공개 `/term start`에는 임기 번호나 기존 임기 자동 종료 옵션이 없습니다. 활성 임기가 있으면 먼저 `/term manage`에서 종료해야 합니다.

### 템플릿 만들기

```text
/template create organization:council name:학생회 현황
```

파일을 첨부하지 않으면 **직접 입력**, **파일 가져오기**, **기존 템플릿 복제**, **취소**를 고릅니다. 실제 파일 가져오기는 명령의 선택 입력 `file`에 UTF-8 `.txt` 파일을 첨부해 다시 실행합니다. 최대 파일 크기는 100KB입니다.

템플릿 패널에서는 내용 편집, 이름 변경, 미리보기, 복제, `.txt` 내보내기, 초안 전환과 삭제를 할 수 있습니다. 게시 설정에서 사용 중인 템플릿은 삭제할 수 없습니다. 초안 템플릿은 게시에 사용할 수 없습니다.

### 게시물 만들기

```text
/publication create organization:학생회 channel:#조직-안내 name:학생회 안내 auto_refresh:true
```

명령 실행 후 해당 조직의 사용 가능한 템플릿을 이름과 사용 현황으로 선택합니다. 초안은 선택 목록에서 제외됩니다. 대상 채널이 일반 텍스트·공지 채널이면 일반 publication을, 포럼 채널이면 forum publication을 만듭니다. 개별 forum thread는 대상 채널로 선택할 수 없습니다.

## 공개 명령어

실제로 등록되는 공개 명령은 다음뿐입니다.

```text
/org create | manage | list
/term start | manage | history
/template create | manage | preview
/publication create | manage | refresh
/diagnose
/help
```

| 명령 | 목적 | 필수 입력 | 선택 입력 | 결과·관련 패널 | 예시 |
|---|---|---|---|---|---|
| `/org create` | 조직 생성 | `name`, `key` | `description` | 조직 관리 패널 | `/org create name:학생회 key:council` |
| `/org manage` | 조직 설정 관리 | `organization` key | 없음 | 기본 정보·역할·분류·필드·임기·게시물·삭제 패널 | `/org manage organization:council` |
| `/org list` | 서버 조직 조회 | 없음 | 없음 | 첫 5개 조직의 임기·역할·게시 상태와 관리 버튼 | `/org list` |
| `/term start` | 임기 생성 | `organization`, `name` | `start_at`, `scheduled_end_at` | 임기 패널 | `/term start organization:council name:제1기` |
| `/term manage` | 현재 임기 상태 관리 | `organization` | 없음 | 임기 패널 | `/term manage organization:council` |
| `/term history` | 임기 이력 조회 | `organization` | 없음 | 최근 기록 첫 페이지 | `/term history organization:council` |
| `/template create` | 템플릿 생성 | `organization`, `name` | `file` | 입력 방식 선택 또는 템플릿 패널 | `/template create organization:council name:현황` |
| `/template manage` | 템플릿 검색·편집·복제·삭제 | 없음 | `organization` 자동완성 | 이름·상태 기반 템플릿 브라우저 | `/template manage organization:학생회` |
| `/template preview` | 현재 데이터로 본문 렌더링 | `template` 자동완성 | 없음 | ephemeral 미리보기, 오류와 길이 | `/template preview template:학생회 현황` |
| `/publication create` | 게시 설정 생성 | `organization`, `channel` | `name`, `auto_refresh` | 사용 가능한 템플릿 선택 후 게시 패널 | `/publication create organization:학생회 channel:#안내` |
| `/publication manage` | 게시·복구·설정·삭제 | 없음 | `organization` 자동완성 | 이름·채널·상태 기반 게시물 브라우저 | `/publication manage organization:학생회` |
| `/publication refresh` | 기존 publication 즉시 갱신 | `publication` 자동완성 | 없음 | 같은 메시지/thread 수정과 진단 | `/publication refresh publication:학생회 안내` |
| `/diagnose` | 서버·조직·게시 범위 진단 | `scope` | `target` | 통합 진단 패널 | `/diagnose scope:organization target:council` |
| `/help` | 작업별 도움말 | 없음 | 없음 | 버튼형 도움말 | `/help` |

`/diagnose`의 `scope`는 `guild`, `organization`, `publication` 중 하나입니다. 조직과 게시물 대상은 `target` 자동완성에서 이름으로 선택합니다. 현재 `publication` 범위는 선택한 게시물이 속한 조직을 찾은 뒤 그 조직의 publication 전체를 검사합니다.

## 게시 기능

### 일반 텍스트 채널 게시

일반 publication의 생명주기는 다음과 같습니다.

```text
/publication create
→ GuildText/GuildAnnouncement 채널 감지
→ 게시 설정을 미게시 상태로 DB에 저장
→ 일반 게시 관리 패널
→ 미리보기
→ 저장하고 게시
→ message ID 저장
→ 이후 refresh에서 같은 message ID를 fetch하고 edit
```

처음 **저장하고 게시**를 누르면 새 메시지를 만들고 ID를 저장합니다. 이후 같은 버튼은 **지금 갱신**으로 표시되며 같은 메시지를 수정합니다. `/publication refresh`도 같은 동작을 합니다.

### 포럼 채널 게시

포럼 publication은 다음 세 요소를 연결해 관리합니다.

- 부모 forum channel
- 그 안의 forum thread 하나
- thread의 starter message 하나

publication에는 starter message ID를, forum 설정에는 thread ID를 저장합니다. 기본 제목 템플릿은 템플릿 이름이며, 게시 전에 **포럼 설정**에서 Liquid 제목으로 바꿀 수 있습니다.

### 포럼 제목 템플릿

본문과 같은 Liquid 컨텍스트를 사용합니다. 렌더링 후 제어 문자와 줄바꿈을 공백으로 바꾸고, 연속 공백을 하나로 합치고, 앞뒤 공백을 제거한 뒤 Discord 제목 제한에 맞춰 100자로 자릅니다. 렌더링 전 결과가 1,000자를 넘으면 오류이며, 정제 결과가 비면 `FORUM_TITLE_EMPTY`로 게시하지 않습니다.

### 포럼 태그

- 게시 패널의 **포럼 태그**에서 최대 5개를 선택합니다.
- 이름 대신 Discord tag ID를 저장하므로 이름을 바꿔도 연결이 유지됩니다.
- 태그가 삭제되면 새로고침에서 제외하고 `FORUM_TAG_MISSING`을 기록합니다.
- 태그 필수 포럼에 유효한 설정 태그가 하나도 없으면 게시를 차단합니다.
- select menu에는 Discord 제한 때문에 포럼의 앞 25개 태그만 표시됩니다.

### 자동 보관 시간

지원 값은 분 단위 `60`, `1440`, `4320`, `10080`입니다. 저장값이 잘못되면 포럼 기본값 또는 `1440`을 사용합니다.

### slowmode

`0`부터 `21600`초까지 설정합니다. 새 thread 생성과 이후 갱신에 적용합니다.

### 게시 후 보관

`archive` flag를 켜면 최초 게시 후 thread를 보관합니다. 갱신 시 bot이 잠시 보관을 해제하고 본문과 설정을 갱신한 뒤 다시 보관합니다. 이 과정에는 `Manage Threads`가 필요합니다.

### 게시 후 잠금

`lock` flag를 켜면 최초 게시 후 thread를 보관하고 잠급니다. 잠긴 thread는 자동·수동 갱신이 모두 `FORUM_THREAD_LOCKED`로 실패합니다.

> [!WARNING]
> `lock`과 `auto_refresh=true`는 서로 충돌합니다. 현재 저장 화면은 이 조합을 막지 않으므로, 자동 갱신을 쓸 때는 잠금을 끄세요.

### 수동 태그 보존

`preserve_manual_tags`를 켜면 Discord에서 관리자가 직접 추가한 유효한 태그를 설정 태그와 합쳐 최대 5개까지 유지합니다. 끄면 저장된 설정 태그가 기준 집합이 되어 수동 태그는 다음 갱신 때 제거됩니다.

### 자동 갱신

`auto_refresh=true`인 publication은 다음 상황에서 queue에 들어갑니다.

- 연결된 역할의 보유자 변경
- 연결된 역할 또는 분류 역할의 삭제
- 연결된 역할 또는 분류 역할의 이름 변경
- 역할 연결·분류·사용자 정의 필드 값을 패널에서 변경
- 예약 임기가 시작되거나 활성 임기가 예정 종료 시각에 만료
- 봇 시작

같은 publication의 연속 요청은 5초 동안 합칩니다. 한 프로세스 안에서는 publication별 lock으로 동시에 두 게시물이 만들어지는 것을 막습니다.

현재 패널에서 임기를 즉시 시작·중지·재개·종료하거나 템플릿 내용을 편집한 직후에는 자동 queue 추가가 구현되어 있지 않습니다. 이 경우 `/publication refresh`를 실행하세요.

### 게시 중 정보 갱신

포럼 refresh는 다음 순서로 동작합니다.

```text
부모 forum channel과 저장된 thread ID 조회
→ 잠금 상태 확인
→ 필요하면 보관 해제
→ 저장된 starter message ID 조회
→ 본문 수정
→ 제목 다시 렌더링
→ 현재 forum tag ID로 태그 검증·적용
→ 자동 보관 시간과 slowmode 적용
→ 원래 보관 상태 또는 archive 설정 복원
```

본문 수정 후 제목·태그·thread 설정 변경만 실패할 수도 있습니다. 이때 본문은 유지하고 `FORUM_SETTING_UPDATE_FAILED`를 기록합니다.

### 게시 설정 삭제

**설정 삭제**는 DB의 publication 연결만 삭제합니다. 이미 작성된 Discord 메시지, forum thread와 starter message는 삭제하지 않습니다. forum 설정 행은 publication과 함께 삭제됩니다.

### 게시물 복구와 재연결

메시지나 thread가 삭제됐으면 `/publication manage`에서 이름과 오류 상태로 게시물을 선택한 뒤 **설정 및 기타 작업** → **연결 복구**를 누릅니다. 확인 후 일반 채널에는 새 메시지를, 포럼에는 새 thread와 starter message를 만들고 내부 연결을 갱신합니다.

복구는 항상 새 Discord 콘텐츠를 만듭니다. 기존 콘텐츠가 아직 남아 있는데 복구를 누르면 중복이 생길 수 있으므로 먼저 **게시물 열기**와 `/diagnose`로 확인하세요. 같은 bot 프로세스에서 동시에 들어온 복구 요청은 하나로 합쳐지지만 여러 프로세스 사이의 중복까지 막지는 못합니다.

## Liquid 템플릿 작성

### 기본 문법

```liquid
{{ organization.name }}
{{ fields.capacity | default: "미정" }}

{% if term %}
현재 임기: {{ term.name }}
{% endif %}

{% for name in roles.member.names %}
- {{ name }}
{% endfor %}
```

`{{ ... }}`는 값을 출력하고 `{% ... %}`는 `if`, `for`, `assign` 같은 제어문을 실행합니다. 누락 변수는 오류 대신 빈 값으로 처리됩니다. `include`, `render`, `layout`과 파일 로딩은 금지됩니다.

### 조직 정보

| 변수 | 내용 |
|---|---|
| `organization.key` | 조직 내부 key |
| `organization.name` | 조직 이름 |
| `organization.foreignName` | 외국어 이름. 현재 공개 패널에서는 편집 불가 |
| `organization.pronunciation` | 발음. 현재 공개 패널에서는 편집 불가 |
| `organization.description` | 설명 |

### 임기 정보

활성 임기가 없으면 `term`은 `null`입니다.

| 변수 | 내용 |
|---|---|
| `term.number` | 임기 번호 또는 `null` |
| `term.name` | 임기 표시 이름 |
| `term.status` | 활성 임기에서는 `active` |
| `term.startDate` | 시작 Date |
| `term.scheduledEndDate` | 예정 종료 Date 또는 `null` |
| `term.actualEndDate` | 실제 종료 Date 또는 `null` |
| `term.endReason` | 종료 사유 또는 `null` |

전체 이력은 `history.terms` 배열입니다. 각 항목은 `number`, `name`, `status`, `startDate`, `endDate`를 가집니다.

### 역할 정보

`roles.<역할 key>`로 읽습니다. 예: `roles.president`.

| 속성 | 내용 |
|---|---|
| `displayName` | 역할 연결 표시 이름 |
| `roleId` | Discord 역할 ID |
| `count` | 보유자 수 |
| `names` / `mentions` | 이름 배열 / 사용자 멘션 배열 |
| `joinedNames` / `joinedMentions` | 쉼표로 연결한 이름 / 멘션 문자열 |
| `vacant` | 보유자가 없으면 `true` |
| `valid` | 역할 존재·필수·단일 보유 조건이 모두 정상이면 `true` |
| `broken` | Discord 역할이 삭제됐거나 찾을 수 없으면 `true` |
| `warnings` | 이 역할 연결의 경고 문자열 배열 |

```liquid
회장: {{ roles.president.joinedMentions | default: "공석" }}
운영진: {{ roles.member.count | number }}명
```

### 분류 정보

`classifications.<분류 key>`로 읽습니다.

| 속성 | 내용 |
|---|---|
| `displayName` | 분류 이름 |
| `population` | 기준 역할 보유자 수 |
| `capacity` | 연결된 정원 필드의 숫자 또는 `null` |
| `overflow` | 정원 초과 인원 |
| `denominator` | 비율 분모. 현재 `population`과 같음 |
| `unassignedCount`, `unassignedNames` | 미분류 인원 수와 이름 배열 |
| `warnings` | 중복·미분류·정원 초과 경고 |
| `groups` | 분류 선택지 결과 배열 |

각 `groups` 항목은 `key`, `displayName`, `roleId`, `roleMention`, `count`, `populationPercentage`, `capacityPercentage`, `memberNames`, `memberMentions`를 가집니다.

```liquid
{% for group in classifications.department.groups %}
- {{ group.displayName }}: {{ group.count }}명 ({{ group.populationPercentage | percentage }})
  {{ group.memberMentions | join_values: ", " | default: "없음" }}
{% endfor %}
```

### 사용자 정의 필드

사용자 정의 값은 `fields.<필드 key>`에 직접 들어갑니다.

```liquid
정원: {{ fields.capacity | default: "미정" }}명
선출일: {{ fields.election_date | date_long }}
문의 역할: {{ fields.contact_role | role_mention }}
```

`{{ fields.capacity.value }}`는 지원하지 않습니다. 실제 변수는 `{{ fields.capacity }}`입니다. DB에는 모든 값이 문자열로 저장되며 `number` 같은 필터가 필요할 때 숫자로 변환합니다. boolean 필드는 문자열이므로 `{% if fields.open == "true" %}`처럼 비교하세요.

### 경고와 진단 정보

`warnings`는 역할과 분류 계산 경고를 합친 문자열 배열입니다.

```liquid
{% if warnings.size > 0 %}
## 확인 필요
{% for warning in warnings %}
- {{ warning }}
{% endfor %}
{% endif %}
```

publication의 채널·thread·렌더 실패 진단은 Liquid `warnings`에 들어가지 않습니다. `/diagnose`와 publication 관리 패널에서 확인합니다.

### 지원 필터

프로젝트가 추가한 필터는 다음과 같습니다.

| 필터 | 예시 | 결과 |
|---|---|---|
| `date_short` | `{{ term.startDate \| date_short }}` | `26.03.01` |
| `date_long` | `{{ term.startDate \| date_long }}` | `2026년 03월 01일` |
| `date_time` | `{{ term.startDate \| date_time }}` | `2026년 03월 01일 00:00` |
| `percentage` | `{{ value \| percentage: 1 }}` | `25.0%` |
| `number` | `{{ value \| number }}` | `1,000` |
| `join_values` | `{{ names \| join_values: ", " }}` | 배열 연결 |
| `role_mention` | `{{ role_id \| role_mention }}` | 유효한 ID이면 `<@&...>` |
| `user_mention` | `{{ user_id \| user_mention }}` | 유효한 ID이면 `<@...>` |

LiquidJS가 제공하는 필터도 실제로 활성화되어 있습니다. 사용할 수 있는 이름은 다음과 같습니다.

```text
abs, append, array_to_sentence_string, at_least, at_most,
base64_decode, base64_encode, capitalize, ceil, cgi_escape, compact, concat,
date, date_to_long_string, date_to_rfc822, date_to_string, date_to_xmlschema,
default, divided_by, downcase, escape, escape_once, find, find_exp,
find_index, find_index_exp, first, floor, group_by, group_by_exp, has, has_exp,
hmac_sha256, inspect, join, json, jsonify, last, lstrip, map, minus, modulo,
newline_to_br, normalize_whitespace, number_of_words, plus, pop, prepend, push,
raw, reject, reject_exp, remove, remove_first, remove_last, replace,
replace_first, replace_last, reverse, round, rstrip, sample, sha256, shift, size,
slice, slugify, sort, sort_natural, split, strip, strip_html, strip_newlines,
sum, times, to_integer, truncate, truncatewords, uniq, unshift, upcase,
uri_escape, url_decode, url_encode, where, where_exp, xml_escape
```

날짜에는 서버 timezone을 자동 적용하는 `date_short`, `date_long`, `date_time`을 권장합니다. 존재하지 않는 필터는 `strictFilters` 설정 때문에 렌더 오류가 됩니다.

### 일반 채널 템플릿 예시

```liquid
# {{ organization.name }}
{{ organization.description }}

{% if term %}
**현재 임기:** {{ term.name }}
**기간:** {{ term.startDate | date_long }}{% if term.scheduledEndDate %} ~ {{ term.scheduledEndDate | date_long }}{% endif %}
{% else %}
**현재 임기:** 없음
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

### 포럼 제목과 본문 예시

제목 템플릿:

```liquid
{{ organization.name }}{% if term %} · {{ term.name }}{% endif %}
```

본문 템플릿:

```liquid
# {{ organization.name }}
{% for group in classifications.department.groups %}
## {{ group.displayName }} · {{ group.count }}명
{{ group.memberMentions | join_values: ", " | default: "배정 없음" }}
{% endfor %}
```

## 실제 구성 예시

### 학생회 예시

역할 연결:

| key | Discord 역할 | kind | cardinality | 필수 |
|---|---|---|---|---:|
| `president` | `@학생회장` | `office` | `one` | 예 |
| `member` | `@학생회` | `membership` | `many` | 아니요 |

사용자 정의 필드 `capacity`를 `organization/number`로 만들고, 분류 `department`의 기준 역할 key를 `member`로 지정합니다. 기획부와 홍보부 역할을 선택지로 추가한 뒤 다음 템플릿을 사용합니다.

```liquid
# {{ organization.name }}
{% if term %}**{{ term.name }}** · {{ term.startDate | date_long }} 시작{% endif %}

회장: {{ roles.president.joinedMentions | default: "공석" }}
전체 학생회: {{ roles.member.count }} / {{ fields.capacity | default: "미정" }}명

{% for department in classifications.department.groups %}
## {{ department.displayName }}
{{ department.memberMentions | join_values: ", " | default: "배정 없음" }}
{% endfor %}

{% for warning in warnings %}
⚠️ {{ warning }}
{% endfor %}
```

### 국민의회 예시

아래 예시는 자동 계산 값과 관리자가 직접 입력하는 필드를 구분합니다.

- 자동: 조직 이름, 현재 임기, 의장·의원 역할 보유자, `party` 분류별 의석수
- 수동 필드: `official_name`, `election`, `region`, `established`, `jurisdiction`, `ruling_party`, `opposition_party`, `inauguration_date`, `nominator`

```liquid
# {{ organization.name }}
{{ fields.official_name | default: "Reichstag" }}

{% if term %}제{{ term.number | default: "-" }}기 {{ organization.name }} · {{ term.name }}{% endif %}

## 정당별 의석
{% for party in classifications.party.groups %}
- {{ party.displayName }}: {{ party.count | number }}석 ({{ party.populationPercentage | percentage }})
{% endfor %}
- 무소속·미분류: {{ classifications.party.unassignedCount | number }}석

## 구성원
- 전체 의원: {{ roles.member.count | number }}명
- 정원: {{ fields.capacity | default: "미정" }}명

## 임기
{% if term %}- {{ term.startDate | date_long }}{% if term.scheduledEndDate %} ~ {{ term.scheduledEndDate | date_long }}{% endif %}{% else %}- 미설정{% endif %}

## 선출
- 선거: {{ fields.election | default: "미설정" }}
- 지역: {{ fields.region | default: "미설정" }}

## 설립과 관할
- 설립: {{ fields.established | default: "미설정" }}
- 관할: {{ fields.jurisdiction | default: "미설정" }}

## 정당
- 여당: {{ fields.ruling_party | default: "미설정" }}
- 야당: {{ fields.opposition_party | default: "미설정" }}

## 의장
- 국민의회 의장: {{ roles.chairperson.joinedMentions | default: "공석" }}
- 취임일: {{ fields.inauguration_date | date_long | default: "미설정" }}
- 임명권자: {{ fields.nominator | default: "미설정" }}

{% if warnings.size > 0 %}
## 확인 필요
{% for warning in warnings %}- {{ warning }}
{% endfor %}{% endif %}
```

## 문제 해결

### 봇이 온라인이 되지 않음

- **증상:** 봇이 offline이고 `Discord bot ready`가 나오지 않습니다.
- **가능한 원인:** token이 틀렸거나 폐기됨, `.env` 문법 오류, `npm install` 누락, 시작 직후 예외가 발생했습니다.
- **확인 방법:** 프로젝트 루트의 `.env`, `node --version`, `node_modules` 존재 여부와 터미널의 최초 오류 로그를 확인합니다.
- **해결 방법:** Node.js 22 이상에서 `npm install`을 실행하고 token을 다시 복사합니다. 노출된 token은 재발급한 뒤 `npm run dev` 또는 `npm start`로 재시작합니다.

### `Used disallowed intents`

- **증상:** 로그인 직후 `Used disallowed intents`로 종료됩니다.
- **가능한 원인:** 코드가 `GuildMembers` intent를 요청하지만 Developer Portal에서 허용하지 않았습니다.
- **확인 방법:** Developer Portal → **Applications** → 해당 애플리케이션 → **Bot** → **Privileged Gateway Intents**를 엽니다.
- **해결 방법:** **Server Members Intent**를 켜고 저장한 뒤 봇을 재시작합니다.

### 슬래시 명령어가 보이지 않음

- **증상:** `/org`, `/term` 등이 자동 완성에 나타나지 않습니다.
- **가능한 원인:** 명령 미등록, 잘못된 Application ID·guild ID, 초대 시 `applications.commands` scope 누락, global 전파 대기입니다.
- **확인 방법:** `.env`의 `DISCORD_CLIENT_ID`, `DISCORD_DEV_GUILD_ID`와 봇 초대 scope를 확인하고 `npm run commands:register` 출력을 봅니다.
- **해결 방법:** 개발 중에는 정확한 `DISCORD_DEV_GUILD_ID`를 넣고 `npm run commands:register`를 다시 실행합니다. global command라면 전파를 기다리고 Discord 클라이언트를 새로고침합니다.

### `DISCORD_TOKEN` 또는 환경 변수가 `undefined`

- **증상:** 환경 설정 검사에서 token 또는 client ID가 비었다고 나옵니다.
- **가능한 원인:** `.env`가 프로젝트 루트에 없거나 `KEY=value` 형식이 깨졌거나 다른 폴더에서 실행했습니다.
- **확인 방법:** `Get-Location`, `Get-Content .env`로 위치와 변수명을 확인하되 token을 공유하지 않습니다.
- **해결 방법:** `.env.example`을 다시 복사해 한 줄에 하나씩 값을 넣고 프로젝트 루트에서 실행합니다.

### 관리 패널이 열리지 않음

- **증상:** 명령은 보이지만 권한 오류 또는 ephemeral 오류가 납니다.
- **가능한 원인:** 사용자가 **Manage Server** 권한도, 기존에 설정된 관리자 역할도 없습니다.
- **확인 방법:** 서버 설정에서 사용자 역할의 **Manage Server** 권한을 확인합니다.
- **해결 방법:** 필요한 관리자에게 **Manage Server**를 부여합니다. 봇 자체의 `Administrator` 권한과는 다른 항목입니다.
- **관련 진단 코드:** `MISSING_PERMISSION`

### 관리 패널 버튼이 동작하지 않음

- **증상:** 버튼을 눌러도 만료·잘못된 상호작용 오류가 납니다.
- **가능한 원인:** bot 재시작, 10~15분짜리 입력 session 만료, custom ID 오류, 대상 삭제입니다.
- **확인 방법:** 새 `/org manage`, `/term manage`, `/template manage` 또는 `/publication manage` 패널에서 재현되는지 확인합니다.
- **해결 방법:** 관련 manage 명령으로 패널을 다시 엽니다. 조직 패널의 **기본 정보** 버튼은 현재 별도 편집 기능이 없습니다.

### 다른 관리자의 패널이라는 오류

- **증상:** 다른 사람이 만든 패널 버튼을 누르면 거부됩니다.
- **가능한 원인:** 패널 custom ID의 owner와 현재 사용자가 다릅니다.
- **확인 방법:** 누가 slash command를 실행했는지 확인합니다.
- **해결 방법:** 각 관리자가 본인 계정으로 같은 manage 명령을 실행해 새 패널을 엽니다.

### 채널을 선택할 수 없음

- **증상:** publication의 `channel` 선택기에 원하는 채널이 없습니다.
- **가능한 원인:** 지원하지 않는 채널 형식이거나 bot이 채널을 볼 수 없습니다.
- **확인 방법:** 채널이 `GuildText`, `GuildAnnouncement`, `GuildForum` 중 하나인지 확인합니다.
- **해결 방법:** 일반 텍스트·공지 또는 부모 포럼 채널을 선택합니다. 개별 forum thread를 publication 대상으로 선택하지 마세요.

### 일반 채널에 게시할 수 없음

- **증상:** 최초 게시 또는 갱신이 권한 오류로 실패합니다.
- **가능한 원인:** View Channels, Send Messages 또는 Read Message History가 없습니다.
- **확인 방법:** 대상 채널의 역할별 권한 override를 포함해 bot의 실효 권한을 확인합니다.
- **해결 방법:** 보기에는 **View Channels**, 최초 게시에는 **Send Messages**, 기존 메시지 조회·수정에는 **Read Message History**를 허용합니다.

### 포럼 게시글을 만들 수 없음

- **증상:** 새 forum thread 또는 starter message 생성이 실패합니다.
- **가능한 원인:** Create Public Threads, Send Messages in Threads 또는 View Channels가 없습니다.
- **확인 방법:** 부모 forum channel의 bot 실효 권한과 태그 필수 설정을 확인합니다.
- **해결 방법:** 해당 권한을 허용하고, 태그 필수 포럼이면 유효한 태그를 선택한 뒤 다시 게시합니다.

### 포럼 제목이 비어 있다는 오류

- **증상:** `FORUM_TITLE_EMPTY`로 게시 또는 갱신이 차단됩니다.
- **가능한 원인:** 제목 template이 비었거나 Liquid 결과가 빈 문자열·공백·줄바꿈뿐입니다.
- **확인 방법:** `/publication manage` → **포럼 설정**에서 제목 template을 확인합니다. 줄바꿈은 공백으로 정제되고 결과는 100자로 잘립니다.
- **해결 방법:** `{{ organization.name }}`처럼 항상 값이 있는 변수를 포함해 저장하고 다시 갱신합니다.
- **관련 진단 코드:** `FORUM_TITLE_EMPTY`

### 포럼 태그가 적용되지 않음

- **증상:** 선택한 태그가 사라지거나 `FORUM_TAG_MISSING`이 표시됩니다.
- **가능한 원인:** 태그 삭제, 다른 forum의 tag ID, 5개 초과 또는 tag ID가 더 이상 유효하지 않습니다.
- **확인 방법:** 부모 forum의 현재 태그 목록과 publication 관리 패널의 선택을 비교합니다.
- **해결 방법:** `/publication manage` → **포럼 태그**를 다시 열어 현재 forum의 유효한 태그를 최대 5개 선택합니다.
- **관련 진단 코드:** `FORUM_TAG_MISSING`, `FORUM_TAG_LIMIT_EXCEEDED`, `FORUM_REQUIRES_TAG`

### 태그 필수 포럼에서 태그를 선택하라는 오류

- **증상:** 유효한 태그가 없다는 메시지와 함께 게시되지 않습니다.
- **가능한 원인:** forum의 **Require Tag**가 켜져 있고 저장 태그가 없거나 모두 삭제됐습니다.
- **확인 방법:** forum 설정과 publication의 **포럼 태그** 선택을 확인합니다.
- **해결 방법:** 현재 사용할 수 있는 태그를 하나 이상 선택하고 다시 게시합니다.
- **관련 진단 코드:** `FORUM_REQUIRES_TAG`

### 포럼 게시물이 자동 갱신되지 않음

- **증상:** 역할 변경 후 starter message, 제목 또는 태그가 바뀌지 않습니다.
- **가능한 원인:** thread 잠금, 자동 갱신 꺼짐, 권한 부족, 삭제된 thread·tag 또는 렌더 오류입니다.
- **확인 방법:** `/publication manage`, `/publication refresh`와 `/diagnose scope:publication target:<ID>`를 차례로 실행합니다.
- **해결 방법:** thread 잠금을 해제하고 `lock` flag를 끄며, View Channels·Send Messages in Threads·Manage Threads·Read Message History를 허용합니다.
- **관련 진단 코드:** `FORUM_THREAD_LOCKED`, `FORUM_SETTING_UPDATE_FAILED`, `PUBLICATION_REFRESH_FAILURE`

### 잠긴 forum thread

- **증상:** `FORUM_THREAD_LOCKED`로 모든 refresh가 실패합니다.
- **가능한 원인:** Discord에서 수동 잠금했거나 `lock` flag로 게시했습니다.
- **확인 방법:** thread 설정의 잠금 상태와 publication의 **포럼 설정** flags를 확인합니다.
- **해결 방법:** Discord에서 잠금을 해제하고 `lock`을 flags에서 제거합니다. 계속 잠글 목적이면 자동 갱신을 끕니다.
- **관련 진단 코드:** `FORUM_THREAD_LOCKED`

### 게시 메시지 또는 forum thread를 삭제함

- **증상:** `PUBLICATION_DELETED`, `FORUM_THREAD_MISSING` 또는 broken 상태가 표시됩니다.
- **가능한 원인:** 저장된 message, starter message 또는 thread가 Discord에서 삭제됐습니다.
- **확인 방법:** `/diagnose`와 `/publication manage`의 상태·게시물 링크를 확인합니다.
- **해결 방법:** **복구·재연결**을 한 번 눌러 새 콘텐츠와 ID를 연결합니다. 여러 bot 프로세스에서 동시에 복구하지 마세요.
- **관련 진단 코드:** `PUBLICATION_DELETED`, `FORUM_THREAD_MISSING`, `PUBLICATION_REFRESH_FAILURE`

### 역할 변경이 게시물에 반영되지 않음

- **증상:** Discord 역할 보유자를 바꿨지만 본문이 그대로입니다.
- **가능한 원인:** 역할 미연결, 자동 갱신 꺼짐, Server Members Intent 꺼짐, publication 오류 또는 5초 queue 대기입니다.
- **확인 방법:** `/org manage` → **역할**, `/publication manage`, `/diagnose`와 startup log를 확인합니다.
- **해결 방법:** 정확한 역할을 연결하고 자동 갱신을 켭니다. Intent를 켠 뒤 재시작하고 `/publication refresh`로 수동 갱신합니다.
- **관련 진단 코드:** `DELETED_DISCORD_ROLE`, `PUBLICATION_REFRESH_FAILURE`

### 필수 역할 공석 경고

- **증상:** 템플릿 `warnings`에 필수 역할 보유자가 없다고 나옵니다.
- **가능한 원인:** `required=true`인 연결 역할에 사용자가 없습니다.
- **확인 방법:** Discord 역할 보유자와 `/org manage`의 역할 연결을 확인합니다.
- **해결 방법:** Discord에서 적절한 사용자에게 역할을 부여하거나 연결 규칙의 필수 여부를 다시 구성합니다.

### 단일 역할에 여러 명이 등록됨

- **증상:** 한 명이어야 한다는 역할 경고가 나옵니다.
- **가능한 원인:** `cardinality=one` 역할에 두 명 이상이 있습니다.
- **확인 방법:** 해당 Discord 역할의 멤버 목록을 확인합니다.
- **해결 방법:** 역할 보유자를 한 명으로 줄이거나 여러 명이 정상이라면 연결을 제거하고 `many`로 다시 추가합니다.

### 분류 역할이 중복됨

- **증상:** 배타적 분류 중복 경고가 나고 사용자가 그룹에 집계되지 않습니다.
- **가능한 원인:** `exclusive=true` 분류에서 한 사람이 선택지 역할을 여러 개 가집니다.
- **확인 방법:** 경고에 표시된 사용자의 Discord 역할을 확인합니다.
- **해결 방법:** 선택지 역할을 하나만 남기거나 비배타적 분류가 필요하면 분류를 다시 구성합니다.

### 정원이 100%를 초과함

- **증상:** `overflow` 경고 또는 `capacityPercentage`가 100%를 넘습니다.
- **가능한 원인:** 기준 역할 보유자가 정원 사용자 정의 필드보다 많습니다.
- **확인 방법:** `fields.capacity`, 분류의 기준 역할 인원과 실제 Discord 역할을 확인합니다.
- **해결 방법:** 잘못된 역할을 정리하거나 정확한 정원 값을 저장합니다.

### Liquid 템플릿 렌더링 실패

- **증상:** 미리보기에 문법·렌더 오류가 나오거나 게시되지 않습니다.
- **가능한 원인:** 알 수 없는 role·field key는 빈 값이 되며, 잘못된 tag, 닫히지 않은 `if`/`for`, 존재하지 않는 filter, 금지된 include 또는 안전하지 않은 mention은 오류가 됩니다.
- **확인 방법:** `/template preview`의 자동완성에서 템플릿 이름을 선택해 오류 문구와 2,000자 길이를 확인합니다. forum 제목은 publication 미리보기에 포함되지 않으므로 **스레드 설정**도 확인합니다.
- **해결 방법:** `default`를 사용하고 key 철자를 고치며 모든 `{% if %}`/`{% for %}`를 `{% endif %}`/`{% endfor %}`로 닫습니다. 본문을 2,000자 이하로 줄이고 제목이 비지 않게 합니다.
- **관련 진단 코드:** `INVALID_TEMPLATE`, `OUTPUT_TOO_LONG`, `FORUM_TITLE_EMPTY`, `PUBLICATION_REFRESH_FAILURE`

### 메시지가 2,000자를 초과함

- **증상:** `OUTPUT_TOO_LONG`으로 게시를 거부합니다.
- **가능한 원인:** 렌더링 결과가 Discord 메시지 제한을 넘었습니다.
- **확인 방법:** 템플릿 미리보기의 `메시지 길이`를 확인합니다.
- **해결 방법:** 항목을 줄이거나 여러 organization/publication으로 분리합니다. 봇은 자동으로 잘라 게시하지 않습니다.

### stale panel(오래된 패널)

- **증상:** 소유자 불일치, 권한 오류, 대상 없음, 만료 또는 잘못된 custom ID 오류가 납니다.
- **가능한 원인:** panel owner mismatch, 관리자 권한 변경, entity 삭제, bot 재시작, session 만료 또는 invalid custom ID입니다.
- **확인 방법:** 같은 사용자가 최신 manage 명령으로 연 패널인지 확인합니다.
- **해결 방법:** 관련 `/org manage`, `/term manage`, `/template manage` 또는 `/publication manage`를 다시 실행합니다.

### 데이터베이스 migration 오류

- **증상:** 테이블·열이 없거나 migration 실행이 실패합니다.
- **가능한 원인:** migration 미적용, data 디렉터리 쓰기 불가, 한 SQLite 파일에 여러 프로세스 접근 또는 `better-sqlite3` native 호환 문제입니다.
- **확인 방법:** `DATABASE_URL`, 디렉터리 권한, 실행 중인 Node 프로세스, Node 22 이상 여부와 전체 오류 로그를 확인합니다.
- **해결 방법:** bot을 모두 중지하고 DB와 `-wal`/`-shm` 파일을 함께 백업한 뒤 `npm install`, `npm run db:migrate`를 실행합니다. 파괴적인 수동 SQL·파일 삭제 전에는 반드시 백업하세요.

### `better-sqlite3` 설치 또는 실행 오류

- **증상:** native module을 로드하지 못하거나 npm 설치가 실패합니다.
- **가능한 원인:** 지원하지 않는 Node 버전, 다른 Node ABI로 설치된 `node_modules`, Windows build tool 문제입니다.
- **확인 방법:** `node --version`, `npm ls better-sqlite3`와 오류의 ABI 번호를 확인합니다.
- **해결 방법:** Node.js 22 이상으로 맞춘 뒤 의존성을 다시 설치합니다. prebuilt binary가 없으면 Windows C++ build tools가 필요할 수 있습니다.

### 자동 갱신이 반복 실패함

- **증상:** log에 `automatic publication refresh failed`가 반복됩니다.
- **가능한 원인:** 삭제된 채널·게시물, 권한, template, locked thread 또는 tag 설정 오류가 고쳐지지 않았습니다.
- **확인 방법:** log를 참고하되 `/publication manage`와 `/diagnose scope:publication`의 자동완성에서 게시물 이름을 선택합니다.
- **해결 방법:** 아래 진단 표에 따라 원인을 고치고 `/publication refresh`를 성공시킨 뒤 자동 갱신을 다시 확인합니다.

## 진단 결과 읽는 법

`/diagnose`는 현재 캐시와 DB를 비교하고, publication refresh는 forum 세부 진단을 반환합니다. `lastRenderError`가 남아 있으면 `/diagnose`에서 `PUBLICATION_REFRESH_FAILURE`로 보일 수 있습니다.

필수 역할 공석, `cardinality=one` 역할의 다중 보유, 배타적 분류 중복, 미분류 인원과 정원 초과는 별도 코드 없이 Liquid `warnings` 배열과 렌더 결과에 표시됩니다.

| 코드 | 의미 | 게시 차단 여부 | 자동 복구 여부 | 사용자가 할 일 |
|---|---|---:|---:|---|
| `DELETED_DISCORD_ROLE` | 역할 연결의 Discord 역할이 삭제됨 | 템플릿 자체는 렌더 가능 | 아니요 | 새 역할 연결을 추가하거나 기존 연결 제거 |
| `INVALID_CLASSIFICATION_MAPPING` | 분류 선택지의 Discord 역할이 삭제됨 | 보통 아니요 | 아니요 | 분류 선택지를 현재 역할로 다시 구성 |
| `MISSING_CHANNEL` | publication 부모 채널이 삭제됨 | 예 | 아니요 | 기존 설정을 삭제하고 올바른 채널로 새 publication 생성 |
| `PUBLICATION_REFRESH_FAILURE` | broken 또는 `lastRenderError`가 있음 | 원인에 따라 다름 | 원인이 사라지면 다음 refresh 가능 | 패널의 원문 오류 확인 후 수동 refresh |
| `FORUM_THREAD_MISSING` | 저장된 thread ID를 서버 캐시에서 찾지 못함 | 기존 thread 갱신 차단 | 아니요 | **복구·재연결** 실행 |
| `FORUM_TAG_MISSING` | 저장 tag ID가 현재 forum에 없음 | 아니요. 유효 태그만 적용 | 아니요 | 포럼 태그를 다시 선택 |
| `FORUM_TAG_LIMIT_EXCEEDED` | 설정 tag ID가 5개 초과 | 아니요. 앞의 유효한 5개 적용 | 부분 적용 | 최대 5개로 다시 저장 |
| `FORUM_REQUIRES_TAG` | 태그 필수 forum에 유효 태그가 없음 | 예 | 아니요 | 현재 태그를 하나 이상 선택 |
| `FORUM_TITLE_EMPTY` | 제목 template 또는 정제 결과가 빈 값 | 예 | 아니요 | 항상 값이 있는 제목 template 저장 |
| `FORUM_SETTINGS_MISSING` | forum publication의 별도 설정 행이 없음 | 예 | 아니요 | publication을 다시 구성 |
| `FORUM_THREAD_LOCKED` | 저장 thread가 잠김 | 예 | 아니요 | 잠금 해제 또는 lock-after-publish 중지 |
| `FORUM_SETTING_UPDATE_FAILED` | 보관 해제나 제목·태그·thread 설정 변경 실패 | 보관 해제 실패 시 예, 본문 후 설정 실패 시 부분 성공 | 다음 refresh에서 재시도 | Manage Threads와 thread 상태 확인 |

그 밖에 사용자 메시지나 log에는 `NOT_FOUND`, `DUPLICATE_KEY`, `ROLE_NOT_FOUND`, `MISSING_PERMISSION`, `INVALID_TERM_TRANSITION`, `MULTIPLE_ACTIVE_TERMS`, `INVALID_TEMPLATE`, `OUTPUT_TOO_LONG`, `PUBLICATION_DELETED`, `CLASSIFICATION_CONFLICT`, `INVALID_FIELD_VALUE`, `VALIDATION_ERROR`가 나타날 수 있습니다. 예상하지 못한 오류에는 문의 코드(correlation ID)가 붙으며, 운영자는 같은 ID를 log에서 검색할 수 있습니다.

## 기존 명령에서 이전하기

현재 slash-command 등록에는 아래 이전 명령이 포함되지 않습니다. 내부 서비스와 일부 레거시 handler는 DB 호환을 위해 남아 있을 수 있습니다.

| 이전 명령 | 현재 위치 |
|---|---|
| `/org-role add/edit/remove` | `/org manage` → **역할** |
| `/classification`, `/classification-option` | `/org manage` → **분류** |
| `/org-field` | `/org manage` → **사용자 정의 필드** |
| `/term pause` | `/term manage` → **일시 중지** |
| `/term resume` | `/term manage` → **재개** |
| `/term end` | `/term manage` → **종료** |
| `/template import` | `/template create`의 선택 입력 `file` |
| `/template edit/delete` | `/template manage` |
| `/publication publish` | `/publication create` 또는 `/publication manage` → **저장하고 게시/지금 갱신** |
| `/publication repair` | `/publication manage` → **복구·재연결** |
| `/publication delete` | `/publication manage` → **설정 삭제** |
| 조직·publication별 이전 진단 | `/diagnose`의 `scope`와 `target` |

## 자주 묻는 질문

### 봇이 Discord 역할을 직접 바꾸나요?

아니요. 역할을 부여하거나 제거하지 않고 현재 역할과 보유자만 읽습니다.

### 여러 조직을 한 서버에서 관리할 수 있나요?

예. 조직별 key를 다르게 만들면 됩니다. 다만 `/org list` 관리 버튼은 현재 처음 5개 조직만 표시합니다.

### 한 조직에 게시물을 여러 개 만들 수 있나요?

예. 같은 조직·템플릿으로도 채널과 설정 이름이 다른 publication을 여러 개 만들 수 있습니다.

### 일반 채널과 포럼에 동시에 게시할 수 있나요?

예. 채널마다 별도 publication을 만들면 각각 고유한 message/thread ID를 유지합니다.

### 게시 설정을 삭제하면 Discord 글도 삭제되나요?

아니요. DB 연결만 삭제하며 기존 메시지와 forum thread는 남습니다.

### 포럼 태그 이름을 바꾸면 연결이 끊기나요?

아니요. 이름이 아니라 tag ID를 저장합니다. 태그 자체를 삭제하면 다시 선택해야 합니다.

### 봇을 재시작해도 게시 연결이 유지되나요?

예. message ID와 thread ID를 SQLite에 저장하며 시작 시 자동 갱신 publication을 queue에 추가합니다.

### 기존 데이터를 초기화해야 하나요?

아니요. 업데이트 후 migration을 적용합니다. 오류 해결을 위해 DB를 임의 삭제하지 말고 먼저 백업하세요.

### 템플릿이 너무 길면 어떻게 하나요?

본문 렌더 결과는 2,000자를 넘을 수 없습니다. 내용을 줄이거나 여러 publication/조직으로 나눕니다. 여러 메시지로 자동 분할하지 않습니다.

### 관리자 권한을 꼭 줘야 하나요?

명령 실행자는 **Manage Server** 또는 기존 설정의 관리자 역할이 필요합니다. bot 자체에는 `Administrator`가 필요 없으며 권한 표의 채널 권한만 주면 됩니다.

### 미리보기에서 forum 제목도 검증하나요?

현재 `/template preview`와 publication의 **미리보기**는 본문만 렌더링합니다. forum 제목은 실제 게시·refresh 시 별도로 렌더링하므로 **포럼 설정**에서 빈 결과가 되지 않게 확인해야 합니다.

## 데이터 백업과 안전

- 기본 SQLite 파일은 프로젝트 기준 `./data/bot.db`입니다.
- 운영 환경에서는 `data` 디렉터리를 재배포 후에도 남는 영속 디스크에 둡니다.
- 백업할 때 bot 프로세스를 중지하고 `.db`와 같은 이름의 `-wal`, `-shm` 파일이 있으면 함께 복사합니다.
- 하나의 SQLite 파일을 여러 bot 프로세스가 동시에 공유하지 마세요. WAL과 5초 busy timeout이 설정되어 있어도 다중 bot 운영을 위한 DB는 아닙니다.
- `.env`와 token을 Git에 commit하지 마세요. `.gitignore`는 `.env`, `data`, `*.db`를 제외합니다.
- publication 설정 삭제는 Discord 콘텐츠를 보존합니다. 조직 삭제는 되돌리기 UI 없이 조직을 숨깁니다.
- 업데이트 후 DB를 백업하고 `npm run db:migrate`를 실행합니다.

## 개발자 참고

사용자 기능은 다음 계층으로 나뉩니다.

- `src/domain`: 역할 해석, 분류 계산, 필드 검증과 임기 상태 전이
- `src/app`: 조직, 권한, 템플릿 context와 publication service
- `src/infrastructure/database`: Drizzle schema, SQLite와 migration
- `src/infrastructure/discord/interactions`: 공개 명령과 관리 패널 상호작용
- `src/infrastructure/template`: Liquid 렌더링, 필터, mention과 길이 검증
- `src/infrastructure/scheduler`: 임기 전환과 publication refresh queue

변경 후 다음을 실행합니다.

```powershell
npm run typecheck
npm test
npm run build
```
