import { ApplicationCommandOptionType, type RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';

const S = ApplicationCommandOptionType.String, I = ApplicationCommandOptionType.Integer, B = ApplicationCommandOptionType.Boolean;
const R = ApplicationCommandOptionType.Role, C = ApplicationCommandOptionType.Channel, A = ApplicationCommandOptionType.Attachment;
const str = (name: string, description: string, required = true) => ({ type: S, name, description, required });
const int = (name: string, description: string, required = true) => ({ type: I, name, description, required });
const bool = (name: string, description: string, required = true) => ({ type: B, name, description, required });
const role = (name: string, description: string) => ({ type: R, name, description, required: true });
const optionalRole = (name: string, description: string) => ({ type: R, name, description, required: false });
const channel = (name: string, description: string) => ({ type: C, name, description, required: true });
const optionalChannel = (name: string, description: string) => ({ type: C, name, description, required: false });
const attachment = (name: string, description: string) => ({ type: A, name, description, required: true });
const choice = (name: string, description: string, values: readonly string[]) => ({ ...str(name, description), choices: values.map((value) => ({ name: value, value })) });
const sub = (name: string, description: string, options: object[] = []) => ({ type: ApplicationCommandOptionType.Subcommand, name, description, options });
const command = (name: string, description: string, options: object[]): RESTPostAPIApplicationCommandsJSONBody => ({ name, description, options }) as RESTPostAPIApplicationCommandsJSONBody;
const org = () => str('organization', '조직 내부 키');

export const commands: RESTPostAPIApplicationCommandsJSONBody[] = [
  command('org', '조직을 관리합니다.', [
    sub('create', '조직을 생성합니다.', [str('key', '고유 내부 키'), str('name', '표시 이름'), str('foreign_name', '외국어 이름', false), str('pronunciation', '발음', false), str('description', '설명', false)]),
    sub('edit', '조직 정보를 수정합니다.', [org(), str('name', '새 표시 이름', false), str('description', '새 설명', false)]), sub('show', '조직 상세를 표시합니다.', [org()]),
    sub('list', '조직 목록을 표시합니다.'), sub('delete', '조직을 삭제합니다.', [org(), bool('confirm', '삭제 확인', false)]), sub('inspect', '조직 설정을 진단합니다.', [org()]),
    sub('config', '서버별 봇 설정을 변경합니다.', [str('time_zone', 'IANA 시간대(예: Asia/Seoul)', false), str('locale', 'locale(예: ko-KR)', false), optionalRole('administrator_role', '봇 관리자 역할')])
  ]),
  command('org-role', '조직 역할 연결을 관리합니다.', [
    sub('add', '역할 연결을 추가합니다.', [org(), str('key', '내부 키'), str('display_name', '표시 이름'), role('role', '연결할 Discord 역할'), choice('kind', '종류', ['office', 'membership']), choice('cardinality', '허용 인원', ['one', 'many']), bool('required', '필수 여부'), int('display_order', '표시 순서', false)]),
    sub('edit', '역할 연결을 수정합니다.', [org(), str('key', '역할 연결 키'), str('display_name', '새 표시 이름', false), optionalRole('role', '새 Discord 역할')]),
    sub('remove', '역할 연결을 제거합니다.', [org(), str('key', '역할 연결 키'), bool('confirm', '삭제 확인', false)]), sub('list', '역할 연결 목록을 표시합니다.', [org()])
  ]),
  command('org-field', '사용자 정의 필드를 관리합니다.', [
    sub('add', '필드 정의를 추가합니다.', [org(), str('key', '내부 키'), str('label', '표시 이름'), choice('scope', '범위', ['organization', 'term']), choice('type', '형식', ['text','multiline_text','number','date','datetime','boolean','select','role','channel']), bool('required', '필수 여부'), str('select_options', '선택값(쉼표 구분)', false), str('default_value', '기본값', false)]),
    sub('edit', '필드 정의를 수정합니다.', [org(), str('key', '필드 키'), str('label', '새 표시 이름', false)]), sub('remove', '필드 정의를 제거합니다.', [org(), str('key', '필드 키'), bool('confirm', '삭제 확인', false)]),
    sub('list', '필드 목록을 표시합니다.', [org()]), sub('set', '필드 값을 설정합니다.', [org(), str('key', '필드 키'), str('value', '일반/날짜/숫자 값', false), optionalRole('role_value', 'role 형식 값'), optionalChannel('channel_value', 'channel 형식 값'), int('term_id', '임기 ID(임기 필드)', false)])
  ]),
  command('classification', '분류를 관리합니다.', [
    sub('create', '분류를 생성합니다.', [org(), str('key', '내부 키'), str('display_name', '표시 이름'), str('base_role_key', '기준 역할 연결 키'), bool('exclusive', '배타적 분류'), bool('allow_unassigned', '미지정 허용'), str('unassigned_label', '미지정 표시 이름'), str('capacity_field_key', '정원 필드 키', false)]),
    sub('edit', '분류를 수정합니다.', [org(), str('key', '분류 키'), str('display_name', '새 표시 이름')]), sub('remove', '분류를 제거합니다.', [org(), str('key', '분류 키'), bool('confirm', '삭제 확인', false)]), sub('list', '분류 목록을 표시합니다.', [org()])
  ]),
  command('classification-option', '분류 선택지를 관리합니다.', [
    sub('add', '분류 선택지를 추가합니다.', [org(), str('classification', '분류 키'), str('key', '선택지 키'), str('display_name', '표시 이름'), role('role', '연결할 Discord 역할'), int('display_order', '표시 순서', false)]),
    sub('edit', '선택지를 수정합니다.', [org(), str('classification', '분류 키'), str('key', '선택지 키'), str('display_name', '새 표시 이름')]),
    sub('remove', '선택지를 제거합니다.', [org(), str('classification', '분류 키'), str('key', '선택지 키'), bool('confirm', '삭제 확인', false)])
  ]),
  command('term', '임기를 관리합니다.', [
    sub('start', '새 임기를 시작합니다.', [org(), str('name', '임기 표시 이름'), int('number', '임기 번호', false), str('start_at', '시작 시각(ISO 8601)', false), str('scheduled_end_at', '예정 종료 시각(ISO 8601)', false), bool('close_current', '기존 활성 임기 종료', false), str('field_values', '필수 임기 필드(key=value;key=value)', false)]),
    sub('edit', '임기 정보를 수정합니다.', [org(), int('term_id', '임기 ID'), str('name', '새 표시 이름', false), str('scheduled_end_at', '새 예정 종료 시각', false)]),
    ...['end','dissolve','suspend','resume'].map((name) => sub(name, `임기를 ${name} 상태로 변경합니다.`, [org(), str('reason', '사유', false)])),
    sub('show', '현재 임기를 표시합니다.', [org()]), sub('history', '임기 기록을 표시합니다.', [org()])
  ]),
  command('template', '게시 템플릿을 관리합니다.', [
    sub('create', '템플릿을 생성합니다.', [org(), str('name', '템플릿 이름'), str('content', 'Liquid 내용(생략 시 modal)', false), bool('draft', '초안으로 저장', false)]),
    sub('edit', '템플릿을 수정합니다.', [org(), str('name', '템플릿 이름'), str('content', '새 내용(생략 시 modal)', false), bool('draft', '초안 여부', false)]),
    sub('import', 'UTF-8 텍스트 파일을 가져옵니다.', [org(), str('name', '템플릿 이름'), attachment('file', 'UTF-8 .txt 파일'), bool('draft', '초안으로 저장', false)]),
    sub('preview', '템플릿을 미리 봅니다.', [org(), str('name', '템플릿 이름')]), sub('show', '템플릿 내용을 표시합니다.', [org(), str('name', '템플릿 이름')]), sub('list', '템플릿 목록을 표시합니다.', [org()]), sub('delete', '템플릿을 삭제합니다.', [org(), str('name', '템플릿 이름'), bool('confirm', '삭제 확인', false)])
  ]),
  command('publication', '자동 갱신 게시물을 관리합니다.', [
    sub('create', '게시 설정을 생성합니다.', [org(), str('name', '게시 이름'), str('template', '템플릿 이름'), channel('channel', '게시 채널'), bool('auto_refresh', '자동 갱신', false)]),
    ...['publish','preview','refresh','repair'].map((name) => sub(name, `게시물을 ${name} 처리합니다.`, [int('publication_id', '게시 설정 ID')])),
    sub('list', '게시 설정 목록을 표시합니다.', [org()]), sub('delete', '게시 설정을 삭제합니다.', [int('publication_id', '게시 설정 ID'), bool('confirm', '삭제 확인', false)])
  ])
];
