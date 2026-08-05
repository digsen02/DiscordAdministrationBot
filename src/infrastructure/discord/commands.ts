import { ApplicationCommandOptionType, ChannelType, type RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';

const stringOption = (name: string, description: string, required = true) => ({
  type: ApplicationCommandOptionType.String, name, description, required
});
const booleanOption = (name: string, description: string, required = false) => ({
  type: ApplicationCommandOptionType.Boolean, name, description, required
});
const attachmentOption = (name: string, description: string) => ({
  type: ApplicationCommandOptionType.Attachment, name, description, required: false
});
const channelOption = (name: string, description: string) => ({
  type: ApplicationCommandOptionType.Channel, name, description, required: true,
  channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum]
});
const subcommand = (name: string, description: string, options: object[] = []) => ({
  type: ApplicationCommandOptionType.Subcommand, name, description, options
});
const command = (name: string, description: string, options: object[] = []): RESTPostAPIApplicationCommandsJSONBody =>
  ({ name, description, options }) as RESTPostAPIApplicationCommandsJSONBody;
const organization = () => stringOption('organization', '조직 키');

/** Stage 3 public surface. Legacy handlers remain in the codebase for data and service compatibility. */
export const commands: RESTPostAPIApplicationCommandsJSONBody[] = [
  command('org', '조직을 만들고 관리합니다.', [
    subcommand('create', '새 조직을 만듭니다.', [
      stringOption('name', '조직 이름'), stringOption('key', '고유 조직 키'),
      stringOption('description', '조직 설명', false)
    ]),
    subcommand('manage', '조직 관리 패널을 엽니다.', [organization()]),
    subcommand('list', '서버의 조직 목록을 봅니다.')
  ]),
  command('term', '임기를 시작하고 관리합니다.', [
    subcommand('start', '새 임기를 시작합니다.', [
      organization(), stringOption('name', '임기 이름'),
      stringOption('start_at', '시작 시각(ISO 8601)', false),
      stringOption('scheduled_end_at', '예정 종료 시각(ISO 8601)', false)
    ]),
    subcommand('manage', '현재 임기 관리 패널을 엽니다.', [organization()]),
    subcommand('history', '과거 임기 목록을 봅니다.', [organization()])
  ]),
  command('template', 'Liquid 템플릿을 만들고 관리합니다.', [
    subcommand('create', '새 템플릿 입력 방식을 선택합니다.', [organization(), stringOption('name', '템플릿 이름'), attachmentOption('file', '선택: UTF-8 .txt 파일(최대 100KB)')]),
    subcommand('manage', '템플릿 관리 패널을 엽니다.', [stringOption('template', '템플릿 ID')]),
    subcommand('preview', '최신 조직·임기 문맥으로 미리 봅니다.', [stringOption('template', '템플릿 ID')])
  ]),
  command('publication', '일반·포럼 게시물을 만들고 관리합니다.', [
    subcommand('create', '게시 설정 패널을 엽니다.', [
      organization(), stringOption('template', '템플릿 ID 또는 이름'), channelOption('channel', '대상 채널'),
      stringOption('name', '게시 설정 이름', false), booleanOption('auto_refresh', '자동 갱신', false)
    ]),
    subcommand('manage', '게시물 관리 패널을 엽니다.', [stringOption('publication', '게시 설정 ID')]),
    subcommand('refresh', '게시물을 즉시 갱신합니다.', [stringOption('publication', '게시 설정 ID')])
  ]),
  command('diagnose', '서버·조직·게시물 문제를 통합 진단합니다.', [
    { ...stringOption('scope', '진단 범위'), choices: ['guild', 'organization', 'publication'].map((value) => ({ name: value, value })) },
    stringOption('target', '조직 키 또는 게시 설정 ID', false)
  ]),
  command('help', '작업 중심의 대화형 도움말을 엽니다.')
];
