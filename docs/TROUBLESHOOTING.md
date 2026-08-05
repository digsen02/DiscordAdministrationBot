# 문제 해결 가이드

먼저 `/diagnose scope:guild`를 실행하고, 게시물 문제라면 `/publication manage`에서 상태와 마지막 오류를 확인하세요. 사용자에게 보이는 문의 코드는 같은 실패의 서버 로그를 찾는 식별자입니다.

## 권한 문제

### 관리 명령을 실행할 수 없음

명령 실행자는 **서버 관리**(`ManageGuild`) 권한 또는 DB에 설정된 관리자 역할이 필요합니다. 관리자 역할을 설정하는 공개 패널은 아직 없으므로 새 설치에서는 서버 관리 권한을 사용합니다.

### 일반 채널 게시 실패

대상 채널에서 봇의 View Channels, Send Messages, Read Message History를 확인합니다. 기존 메시지는 봇 자신이 작성한 글만 수정할 수 있습니다.

### 포럼 게시·갱신 실패

대상 포럼과 thread에서 View Channels, Create Public Threads, Send Messages in Threads, Manage Threads, Read Message History를 확인합니다. 채널 권한 덮어쓰기가 서버 역할 권한을 거부할 수 있습니다.

## 포럼 문제

### 태그가 사라지거나 적용되지 않음

1. `/publication manage`에서 게시물을 엽니다.
2. **설정 및 기타 작업 → 제목과 태그**에서 현재 존재하는 태그를 다시 선택합니다.
3. 태그 필수 포럼에서는 적어도 하나를 선택합니다.
4. Discord 제한에 따라 최종 태그는 최대 5개입니다.

`preserve_manual_tags`가 켜지면 설정 태그 외에 Discord에서 수동으로 붙인 유효 태그를 보존합니다. 전체 태그가 5개를 넘으면 앞의 5개만 남습니다.

### 보관된 글을 갱신할 수 없음

봇은 보관된 thread를 잠시 열어 starter message와 설정을 고친 뒤 원래처럼 다시 보관합니다. Manage Threads 권한이 없으면 실패합니다.

### 잠긴 글을 갱신할 수 없음

잠금은 보관보다 강한 종료 상태입니다. Discord에서 잠금을 풀고 게시 설정의 flags에서 `lock`을 제거한 뒤 **지금 갱신**을 실행하세요. 자동 갱신을 계속 쓸 게시물에는 게시 후 잠금을 사용하지 마세요.

### 본문은 바뀌었지만 제목·태그는 실패함

`FORUM_SETTING_UPDATE_FAILED`는 starter message 수정 뒤 thread 설정 변경에서 실패할 때도 발생합니다. 권한, 현재 태그, 자동 보관 값과 slowmode 범위를 확인하고 다시 갱신하세요.

## 템플릿 문제

### 문법 또는 렌더 오류

- 변수 key와 필터 철자를 확인합니다.
- `{% if %}`/`{% for %}`에 `{% endif %}`/`{% endfor %}`가 있는지 확인합니다.
- `include`, `render`, `layout` 태그를 제거합니다.
- 없는 값에는 `default` 또는 `if`를 사용합니다.
- `@everyone`, `@here`와 직접 작성한 임의 멘션을 제거합니다.

### 결과가 너무 김

본문은 2,000자를 넘으면 실패하며 잘라서 게시하지 않습니다. 반복 항목을 줄이거나 조직·게시물을 나누세요. 포럼 제목은 100자로 정리됩니다.

### 날짜가 비어 있음

값이 ISO 8601 날짜 문자열인지 확인합니다. date 필드는 `YYYY-MM-DD`, datetime은 `2026-08-02T12:30:00+09:00`처럼 입력합니다. 활성 임기가 없으면 `term`이 비어 있으므로 먼저 `{% if term %}`로 감싸세요.

### 비율 뒤에 `%`가 두 번 나옴

`percentage`가 `%`를 포함합니다.

```liquid
{{ group.capacityPercentage | percentage: 1 }}
```

뒤에 `%`를 쓰지 마세요.

## SQLite와 설치 문제

### migration 실패

1. 모든 봇 프로세스를 중지합니다.
2. `DATABASE_URL`이 가리키는 `.db`, `-wal`, `-shm` 파일을 함께 백업합니다.
3. DB 상위 폴더에 쓰기 권한이 있는지 확인합니다.
4. 기본 경로가 아니면 같은 PowerShell에서 환경 변수를 설정합니다.

```powershell
$env:DATABASE_URL='D:\DiscordBotData\bot.db'
npm run db:migrate
```

하나의 SQLite 파일을 여러 봇 프로세스가 동시에 공유하지 마세요. 오류 해결을 위해 DB 파일을 먼저 삭제하지 마세요.

### `better-sqlite3` native module 오류

1. `node --version`이 22 이상인지 확인합니다.
2. 현재 Node 버전에서 `npm install`을 다시 실행합니다.
3. prebuilt binary가 없는 환경이면 Windows C++ Build Tools 설치가 필요할 수 있습니다.
4. 오류의 Node ABI와 `npm ls better-sqlite3` 결과를 함께 확인합니다.

## 삭제된 Discord 리소스

- 역할 삭제: 새 Discord 역할을 연결한 뒤 오래된 연결을 제거합니다.
- 메시지 또는 thread 삭제: 게시물 패널의 **연결 복구 → 대체 게시물 만들기**를 사용합니다.
- 대상 채널 삭제: 채널 변경 화면이 없으므로 새 채널에 새 게시 설정을 만듭니다.
- 게시 설정 삭제: Discord 메시지나 thread는 자동으로 삭제되지 않습니다.

## 진단 코드 참고

| 코드 | 의미 | 복구 방법 |
|---|---|---|
| `NOT_FOUND` | 조직·템플릿·게시물·Discord 리소스를 찾지 못함 | 이름 자동 완성에서 다시 선택하거나 삭제 여부 확인 |
| `DUPLICATE_KEY` | 같은 key 또는 이름이 이미 있음 | 다른 key·이름 사용 |
| `ROLE_NOT_FOUND` | 역할을 찾지 못함 | 현재 Discord 역할 다시 선택 |
| `MISSING_PERMISSION` | 관리자 또는 채널 권한 부족 | 위 권한 점검 |
| `INVALID_TERM_TRANSITION` | 허용되지 않는 임기 상태 변경 | 현재 상태에 표시되는 패널 작업 사용 |
| `MULTIPLE_ACTIVE_TERMS` | 활성 임기가 이미 있음 | 현재 임기를 종료한 뒤 새 임기 시작 |
| `INVALID_TEMPLATE` | 템플릿 문법·필터·멘션 또는 사용 상태 문제 | 미리보기 오류 수정, 초안 상태 확인 |
| `OUTPUT_TOO_LONG` | 본문이 2,000자를 넘음 | 템플릿 축소 또는 게시물 분리 |
| `PUBLICATION_DELETED` | 메시지 또는 thread가 삭제됨 | 연결 복구 |
| `CLASSIFICATION_CONFLICT` | 분류 설정 충돌 | 기준·선택지 역할 확인 |
| `INVALID_FIELD_VALUE` | 필드 형식과 값이 맞지 않음 | 필드 형식에 맞게 다시 입력 |
| `VALIDATION_ERROR` | 입력값 또는 현재 작업 흐름이 유효하지 않음 | 안내 문구에 따라 새 패널에서 다시 입력 |
| `DELETED_DISCORD_ROLE` | 진단에서 연결 역할 삭제를 발견 | 역할 연결 교체 |
| `INVALID_CLASSIFICATION_MAPPING` | 분류 선택지 역할이 삭제됨 | 현재 역할로 선택지 다시 구성 |
| `MISSING_CHANNEL` | 게시 대상 채널이 삭제됨 | 새 게시 설정 생성 |
| `PUBLICATION_REFRESH_FAILURE` | 최근 갱신 오류가 남아 있음 | 게시물 상세의 원문 오류 수정 후 수동 갱신 |
| `FORUM_THREAD_MISSING` | 저장된 포럼 thread를 찾지 못함 | 연결 복구 |
| `FORUM_TAG_MISSING` | 저장한 태그가 현재 포럼에 없음 | 태그 다시 선택 |
| `FORUM_TAG_LIMIT_EXCEEDED` | 설정 태그가 5개를 넘음 | 5개 이하로 선택 |
| `FORUM_REQUIRES_TAG` | 태그 필수 포럼에 유효 태그가 없음 | 현재 태그 하나 이상 선택 |
| `FORUM_TITLE_EMPTY` | 제목 템플릿 결과가 비어 있음 | 항상 값이 남는 제목 작성 |
| `FORUM_SETTINGS_MISSING` | 포럼 게시 설정 행이 없음 | 게시 설정을 새로 구성 |
| `FORUM_THREAD_LOCKED` | thread가 잠김 | Discord에서 잠금 해제, `lock` 제거 |
| `FORUM_SETTING_UPDATE_FAILED` | 본문 뒤 제목·태그·thread 설정 갱신 실패 | Manage Threads와 입력 범위 확인 후 재시도 |

`DELETED_DISCORD_ROLE`, `INVALID_CLASSIFICATION_MAPPING`, `MISSING_CHANNEL`, `PUBLICATION_REFRESH_FAILURE`, `FORUM_THREAD_MISSING`는 `/diagnose`가 표시하는 상태 코드입니다. 나머지는 명령·게시 서비스가 직접 반환할 수 있습니다.

## 로그 확인

예상하지 못한 오류에는 문의 코드가 붙습니다. 서버 로그에서 같은 코드를 검색하면 해당 명령, 서버와 오류 stack을 찾을 수 있습니다. 자동 갱신 실패는 `automatic publication refresh failed`, 부분 포럼 진단은 `automatic publication refresh diagnostics` 로그로 남습니다.
