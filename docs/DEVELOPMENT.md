# 개발 및 호환성 참고

이 문서는 일반 서버 관리자보다 프로젝트를 운영·수정하는 개발자를 위한 상세 참고입니다. 사용자 설치와 조직 설정은 [README](../README.md)를 먼저 읽으세요.

## 실행과 검증

Node.js 22 이상이 필요합니다.

```powershell
npm install
npm run db:migrate
npm run commands:register
npm run typecheck
npm test
npm run build
npm start
```

개발 중에는 `npm run dev`, 반복 테스트에는 `npm run test:watch`를 사용할 수 있습니다.

`src/index.ts`는 시작 시 Drizzle migration도 실행합니다. 운영 배포에서는 시작 전에 `npm run db:migrate`를 별도로 실행해 migration 오류를 서비스 시작과 분리하는 편이 안전합니다.

## 코드 구조

- `src/domain`: 역할 해석, 분류 계산, 사용자 정의 필드 검증, 임기 상태 전환
- `src/app/services`: 조직, 권한, 템플릿 컨텍스트와 게시 서비스
- `src/infrastructure/database`: better-sqlite3 연결, Drizzle schema, migration과 개발 seed
- `src/infrastructure/discord/commands.ts`: 실제 등록되는 공개 명령
- `src/infrastructure/discord/interactions`: 자동 완성, 관리 패널, 브라우저와 상호작용 controller
- `src/infrastructure/template`: Liquid 렌더러와 필터, 멘션·길이 검증
- `src/infrastructure/scheduler`: 예약 임기 전환과 5초 refresh queue
- `tests`: 도메인, 렌더러, 게시 서비스, 포럼, scheduler와 관리 UX 테스트

`InteractionHandler`에는 과거 명령 처리 코드가 일부 남아 있지만, 현재 공개 명령은 `ManagementInteractionRouter`가 먼저 처리합니다. 문서와 새 기능은 `commands.ts`와 management controller를 기준으로 판단해야 합니다.

## 데이터베이스와 지속성

기본 경로는 `./data/bot.db`이며 `DATABASE_URL`로 바꿀 수 있습니다. 연결 시 다음 SQLite 설정을 사용합니다.

- WAL journal mode
- foreign keys 활성화
- busy timeout 5초

하나의 SQLite 파일을 여러 봇 프로세스가 동시에 공유하는 운영은 지원 대상으로 보지 않습니다.

### 백업

1. 봇 프로세스를 중지합니다.
2. `DATABASE_URL`이 가리키는 `.db` 파일을 복사합니다.
3. 같은 위치에 `-wal`, `-shm` 파일이 있으면 함께 복사합니다.
4. migration 전 백업을 별도로 보관합니다.

### migration과 호환성

- `drizzle/0000_silly_sharon_carter.sql`: 초기 schema
- `drizzle/0001_typical_blonde_phantom.sql`: 조직·임기 범위 custom field 값의 부분 unique index 수정
- `drizzle/0002_lonely_galactus.sql`: 조직 soft delete와 포럼 게시 설정 추가

기존 데이터는 migration으로 유지합니다. v1/v2 관리 component custom ID parser와 기존 publication의 message/thread ID도 유지됩니다. 반면 과거 `/org-role`, `/org-field`, `/classification`, `/publication repair` 같은 명령은 현재 `commands.ts`에 등록되지 않으므로 새 사용자 문서에서 사용하면 안 됩니다.

## 템플릿 컨텍스트

`ContextBuilder`가 다음 최상위 값을 만듭니다.

- `organization`
- 활성 임기 하나 또는 `null`인 `term`
- 현재 조직 또는 활성 임기에 맞는 `fields`
- Discord 역할 보유자를 해석한 `roles`
- 기준 역할과 선택지 역할로 계산한 `classifications`
- 모든 임기를 포함하는 `history`
- 역할·분류 경고를 합친 `warnings`

렌더러는 LiquidJS를 `strictFilters: true`, `strictVariables: false`, `dynamicPartials: false`, `cache: false`로 생성합니다. 외부 파일 태그인 `include`, `render`, `layout`은 명시적으로 거부합니다. 본문 기본 제한은 2,000자이며 포럼 제목은 렌더 후 제어 문자와 연속 공백을 정리하고 100자로 자릅니다.

등록 필터는 `date_short`, `date_long`, `date_time`, `percentage`, `number`, `join_values`, `role_mention`, `user_mention`입니다. 날짜 필터는 guild config의 time zone을 자동 주입하고 기본값은 `Asia/Seoul`입니다.

멘션은 빌드된 컨텍스트에 포함된 사용자와 역할만 허용합니다. `@everyone`, `@here`, 임의 사용자·역할 멘션은 렌더 단계에서 거부합니다.

## 게시와 자동 갱신

일반 채널은 최초 refresh에서 메시지를 만들고 이후 저장된 `messageId`를 수정합니다. 포럼은 `threadId`와 starter `messageId`를 모두 저장합니다.

`RefreshQueue`는 publication별로 5초 debounce합니다. 다음 이벤트가 queue를 채웁니다.

- `GuildMemberUpdate`의 역할 변화
- 연결 역할의 삭제 또는 이름 변경
- 기존 role binding 수정·제거, classification·custom field 변경
- 예약 임기의 scheduler 기반 시작 또는 만료
- ClientReady 시 자동 갱신 publication

현재 controller에서 새 role binding 추가, template edit, publication 설정 edit, 포럼 설정 edit, 수동 term 상태 전환은 queue를 채우지 않습니다. 해당 작업 뒤에는 UI의 수동 publish/refresh가 필요합니다.

`PublicationService`는 publication별 in-memory promise lock으로 같은 publication의 동시 refresh를 합칩니다. Discord에서 대상 메시지나 thread가 삭제된 경우 `broken`과 마지막 오류를 저장합니다. repair는 새 메시지 또는 thread를 만든 뒤 저장된 연결을 교체합니다.

## 상호작용 라우팅과 소유권

현재 management component custom ID 형식은 다음과 같습니다.

```text
<area>:v<version>:<action>:<target>:<owner-user-id>
```

- `area`: `org`, `term`, `tpl`, `pub`, `diag`, `help`
- `version`: parser가 허용하는 `v1` 또는 `v2`
- `action`: controller가 처리할 작업
- `target`: 조직·템플릿·게시 설정 ID 또는 생성 session token
- `owner-user-id`: 패널을 연 Discord 사용자

`ManagementInteractionRouter`가 등록된 현재 명령과 management component를 먼저 처리합니다. `parseCustomId`가 구조를 검사하고 `assertOwner`가 패널 소유자만 후속 선택·버튼·모달을 사용할 수 있게 합니다. 이후 `PermissionService`가 서버 관리 권한 또는 설정된 관리자 역할을 다시 검사합니다.

생성 도중 여러 단계가 필요한 역할, 분류 선택지, 템플릿과 게시 설정은 `setup_sessions`에 사용자·서버·만료 시각과 중간 상태를 저장합니다. 만료된 session은 재사용하지 않으며 관련 명령을 다시 시작해야 합니다. 세션은 프로세스 메모리만이 아니라 SQLite에 있지만, 이를 장기 실행 작업이나 일반적인 interaction session 프레임워크로 확대 해석하면 안 됩니다.

이전 handler가 인식하는 `confirm:`, `template:`, `field:`, `forum:` 형식은 아직 남은 레거시 처리 경로입니다. 새 패널은 `customId()`/`managementId()`와 management router를 사용해야 합니다.

## 동시성, queue와 lock

- `RefreshQueue`는 publication ID별 `setTimeout`을 하나만 유지해 5초 동안 들어온 변경을 debounce합니다.
- `PublicationService.refreshLocks`는 같은 프로세스 안에서 동일 publication의 동시 refresh promise를 공유합니다.
- 이 lock은 여러 프로세스 사이의 분산 lock이 아닙니다. 한 SQLite DB를 여러 봇 프로세스가 공유하지 않는다는 운영 전제가 필요합니다.
- queue는 메모리에 있으므로 프로세스가 종료되면 pending timer가 사라집니다. 다음 시작의 `ClientReady`에서 자동 갱신 publication을 다시 enqueue합니다.

오류 코드와 사용자 복구 방법은 [문제 해결 가이드](TROUBLESHOOTING.md#진단-코드-참고)에 모아 두었습니다.

## 현재 패널의 제한

다음 schema·service 기능은 존재하지만 현재 공개 management panel에서 설정할 수 없습니다.

- `organizations.foreignName`, `organizations.pronunciation` 편집
- `guildConfigs.timeZone`, `locale`, `administratorRoleId` 편집
- `classifications.capacityFieldKey`, `unassignedLabel`, `displayOrder` 편집
- 임기 번호, 시작 후 이름·날짜·종료 사유 편집
- publication 대상 채널 변경
- `role`·`channel` custom field를 선택 메뉴로 입력

특히 `capacityPercentage`는 `classification.capacityFieldKey`가 실제 number custom field key와 연결된 경우에만 계산됩니다. 현재 패널로 새 classification을 만들면 이 값은 `null`입니다. `src/infrastructure/database/seed.ts`는 개발 fixture에서 이 연결을 만드는 예를 포함하지만, 실제 Discord ID가 가짜이므로 운영 DB에 그대로 실행하면 안 됩니다.

이 제한을 우회하는 DB 수동 편집은 일반 사용자 절차로 간주하지 않습니다. UI를 추가할 때는 schema만 수정하지 말고 command/panel, validation, audit, refresh queue와 UX 테스트를 함께 갱신해야 합니다.

## 보안과 운영 주의

- `.env`, DB 파일과 bot token을 커밋하지 않습니다.
- 토큰이 노출되면 Developer Portal에서 즉시 재발급합니다.
- 봇에는 `Administrator` 대신 필요한 채널 권한만 부여합니다.
- 관리 작업은 `ManageGuild` 또는 DB의 administrator role 보유자만 통과합니다. 다만 administrator role을 설정하는 현재 공개 UI는 없습니다.
- organization delete는 soft delete이며 공개 UI에 복원 작업이 없습니다.
- publication delete는 Discord 콘텐츠를 삭제하지 않습니다.
- 잠긴 forum thread는 자동 갱신할 수 없습니다.
