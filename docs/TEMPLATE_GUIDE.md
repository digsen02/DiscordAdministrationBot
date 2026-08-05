# Liquid 템플릿 가이드

이 문서는 Discord Organization Manager가 실제로 만드는 템플릿 컨텍스트와 `liquidjs` 10.28.0 렌더러를 기준으로 합니다. 처음 게시하는 방법은 [README](../README.md)를 먼저 읽으세요.

## 작성하고 확인하는 순서

1. `/template create`에서 조직과 템플릿 이름을 고릅니다.
2. **직접 입력**, UTF-8 `.txt` 파일 또는 같은 조직의 기존 템플릿 복제를 선택합니다.
3. `/template preview` 또는 템플릿 패널의 **미리보기**로 실제 역할과 현재 임기를 넣은 결과를 확인합니다.
4. 게시물에서 쓰기 전 결과가 2,000자 이하인지 확인합니다.

존재하지 않는 변수는 대체로 빈 값이지만, 존재하지 않는 필터는 오류가 됩니다. `include`, `render`, `layout`처럼 파일을 불러오는 태그는 사용할 수 없습니다.

## 단계별 예제

### 1. 조직 이름

```liquid
# {{ organization.name }}
{{ organization.description | default: "설명 없음" }}
```

### 2. 현재 임기

활성 임기가 없으면 `term`은 `null`입니다.

```liquid
{% if term %}
현재 임기: {{ term.name }}
시작: {{ term.startDate | date_long }}
{% else %}
현재 임기 없음
{% endif %}
```

### 3. 직책과 구성원

`president`, `member`는 역할 연결을 만들 때 입력한 key입니다.

```liquid
학생회장: {{ roles.president.joinedMentions | default: "공석" }}
구성원 수: {{ roles.member.count | number }}명
구성원 이름: {{ roles.member.names | join_values: ", " | default: "없음" }}
```

### 4. 분류 반복

`party`는 분류 key입니다.

```liquid
{% assign party = classifications.party %}
{% for group in party.groups %}
- {{ group.roleMention }} {{ group.displayName }}: {{ group.count }}명
{% endfor %}
```

정원 필드가 분류에 연결된 데이터만 `capacity`와 `capacityPercentage`를 가집니다.

```liquid
{% if party.capacity %}
{% for group in party.groups %}
- {{ group.displayName }}: {{ group.count }}/{{ party.capacity }} ({{ group.capacityPercentage | percentage: 1 }})
{% endfor %}
{% endif %}
```

`percentage` 필터가 `%`를 포함하므로 별도의 `%`를 덧붙이지 않습니다.

### 5. 사용자 정의 필드

`location`은 추가 정보에서 만든 필드 key입니다. 현재 구현은 모든 값을 문자열로 저장하며, 필터가 날짜나 숫자로 해석합니다.

```liquid
소재지: {{ fields.location | default: "미정" }}
정원: {{ fields.seat_capacity | number }}명
설립일: {{ fields.founded_at | date_long | default: "미정" }}
```

### 6. 이력과 경고

```liquid
과거 임기 수: {{ history.terms.size }}
{% for past in history.terms %}
- {{ past.name }} · {{ past.startDate | date_short }}
{% endfor %}

{% if warnings.size > 0 %}
## 확인 필요
{% for warning in warnings %}- {{ warning }}
{% endfor %}{% endif %}
```

`warnings`에는 필수 직책 공석, 1명 직책의 여러 보유자, 삭제된 역할, 배타적 분류 중복, 허용되지 않은 미분류 인원과 정원 초과가 들어갑니다. 게시 채널·포럼·최근 갱신 오류는 `/diagnose`에서 확인합니다.

## 전체 변수 참고

### `organization`

| 속성 | 의미 |
|---|---|
| `key` | 조직 내부 key |
| `name` | 조직 이름 |
| `foreignName` | 외국어 이름 또는 `null`; 현재 공개 패널에서 편집 불가 |
| `pronunciation` | 발음 또는 `null`; 현재 공개 패널에서 편집 불가 |
| `description` | 설명 또는 `null` |

### `term`

활성 임기가 없으면 전체가 `null`입니다.

| 속성 | 의미 |
|---|---|
| `number` | 임기 번호 또는 `null`; 현재 공개 명령에서 입력 불가 |
| `name` | 임기 이름 |
| `status` | 현재 렌더에서는 보통 `active` |
| `startDate` | 시작 시각 |
| `scheduledEndDate` | 예정 종료 시각 또는 `null` |
| `actualEndDate` | 실제 종료 시각 또는 `null` |
| `endReason` | 종료 사유 또는 `null` |

### `roles.<역할 key>`

| 속성 | 의미 |
|---|---|
| `displayName` | 역할 연결의 표시 이름 |
| `roleId` | 연결된 Discord 역할 ID |
| `count` | 현재 보유자 수 |
| `names`, `mentions` | 보유자 이름·멘션 배열 |
| `joinedNames`, `joinedMentions` | 쉼표로 연결한 이름·멘션 |
| `vacant` | 보유자가 없으면 `true` |
| `valid` | 인원·필수 규칙과 역할 존재 여부가 정상이면 `true` |
| `broken` | Discord 역할이 삭제됐으면 `true` |
| `warnings` | 이 역할 연결의 경고 배열 |

### `classifications.<분류 key>`

| 속성 | 의미 |
|---|---|
| `displayName` | 분류 이름 |
| `population` | 기준 구성원 역할의 보유자 수 |
| `capacity` | 연결된 정원 또는 `null` |
| `overflow` | 정원 초과 인원 |
| `denominator` | 인구 비율의 분모; 현재 `population`과 같음 |
| `unassignedCount`, `unassignedNames` | 선택지 역할이 없는 기준 구성원 |
| `warnings` | 중복·미분류·정원 초과 경고 |
| `groups` | 분류 선택지 결과 배열 |

각 `groups` 항목에는 다음 값이 있습니다.

| 속성 | 의미 |
|---|---|
| `key`, `displayName` | 선택지 key와 이름 |
| `roleId`, `roleMention` | Discord 역할 ID와 멘션 |
| `count` | 해당 선택지 인원 |
| `populationPercentage` | 기준 구성원 중 비율 |
| `capacityPercentage` | 정원 대비 비율 또는 `null` |
| `memberNames`, `memberMentions` | 구성원 이름·멘션 배열 |

### `fields`, `history`, `warnings`

- `fields.<필드 key>`: 현재 조직 또는 현재 활성 임기에 맞는 값. 값이 없으면 기본값 또는 `null`입니다.
- `history.terms`: 모든 임기를 시작일 오름차순으로 담은 배열입니다. 각 항목은 `number`, `name`, `status`, `startDate`, `endDate`를 가집니다.
- `warnings`: 모든 역할·분류 경고를 합친 배열입니다.

## 봇 전용 필터

| 필터 | 예시 | 결과 |
|---|---|---|
| `date_short` | `{{ term.startDate \| date_short }}` | `26.08.02` |
| `date_long` | `{{ term.startDate \| date_long }}` | `2026년 08월 02일` |
| `date_time` | `{{ term.startDate \| date_time }}` | `2026년 08월 02일 00:00` |
| `percentage` | `{{ value \| percentage: 1 }}` | `25.0%` |
| `number` | `{{ value \| number }}` | `1,000` |
| `join_values` | `{{ names \| join_values: ", " }}` | 배열을 문자열로 연결 |
| `role_mention` | `{{ role_id \| role_mention }}` | 유효한 ID를 역할 멘션으로 변환 |
| `user_mention` | `{{ user_id \| user_mention }}` | 유효한 ID를 사용자 멘션으로 변환 |

날짜 필터는 서버 시간대를 자동으로 사용하며 현재 공개 패널에서 시간대를 바꾸지 않았다면 `Asia/Seoul`입니다. `role_mention`과 `user_mention` 결과도 현재 컨텍스트에서 허용된 역할·사용자여야 게시할 수 있습니다.

## LiquidJS 기본 필터

현재 설치된 `liquidjs` 10.28.0에서 활성화된 기본 필터 이름은 다음과 같습니다. 버전 변경 시 달라질 수 있으며, 존재하지 않는 이름은 `strictFilters` 설정 때문에 오류가 됩니다.

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

날짜에는 LiquidJS 기본 `date`보다 서버 시간대를 적용하는 `date_short`, `date_long`, `date_time`을 권장합니다.

## 안전 제한

- 본문은 최대 2,000자입니다. 자동 분할하지 않습니다.
- 템플릿 입력과 수정 모달은 최대 4,000자입니다. 더 긴 템플릿은 100KB 이하 UTF-8 `.txt`로 가져오세요.
- 포럼 제목 템플릿은 렌더 후 제어 문자와 연속 공백을 정리하고 100자로 자릅니다.
- `@everyone`, `@here`, 연결되지 않은 역할과 실제 역할 보유자가 아닌 사용자의 임의 멘션은 거부합니다.
- 외부 파일을 읽는 `include`, `render`, `layout` 태그는 거부합니다.
- 동적 partial과 템플릿 캐시는 사용하지 않습니다.

## 의회 전체 예제

정원 필드가 분류에 연결된 기존 데이터용 예제입니다. 현재 공개 패널에서 새 정원 연결을 만들 수 없다는 제한은 [README의 국가의회 예시](../README.md#정당-분류가-있는-국가의회)를 확인하세요.

```liquid
# {{ organization.name }}
{% if organization.foreignName %}**{{ organization.foreignName }}**{% endif %}
{% if organization.pronunciation %}-# {{ organization.pronunciation }}{% endif %}

{% if term %}## {{ term.name }}
({{ term.startDate | date_short }}~){% endif %}

{% assign party = classifications.party %}
{% for group in party.groups %}
- {{ group.roleMention }} `{{ group.displayName }}` `{{ group.count }}/{{ party.capacity }}` `{{ group.capacityPercentage | percentage: 1 }}`
{% endfor %}

{% if warnings.size > 0 %}## 확인 필요
{% for warning in warnings %}- {{ warning }}
{% endfor %}{% endif %}
```
