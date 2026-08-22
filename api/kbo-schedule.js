/**
 * api/kbo-schedule.js — Vercel 서버리스 함수
 *
 * 브라우저에서 KBO 사이트를 직접 fetch하면 CORS에 막히므로, 이 함수가 대신
 * KBO 내부 웹서비스를 호출하고 결과를 정제해서 JSON으로 돌려준다.
 *
 * 캐싱 전략 (별도 cron/DB 없이 Vercel CDN 캐시만 사용):
 * - 과거 날짜: 경기 결과가 더 이상 바뀌지 않으므로 하루(86400초) 캐싱.
 * - 오늘/미래 날짜: 경기가 진행 중일 수 있으므로 10분(600초) 캐싱.
 * 이렇게 하면 "매일 전체를 긁어오는 cron"보다 KBO 서버 부하가 훨씬 적다.
 * 실제로 조회된 달만, 그것도 캐시가 만료됐을 때만 가져오기 때문이다.
 *
 * 주의: KBO가 공식 제공하는 API가 아니라 사이트 내부에서 쓰는 비공식
 * 엔드포인트다. KBO가 구조를 바꾸면 동작하지 않을 수 있다.
 */

const KBO_ENDPOINT = 'https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList';

/** HTML 태그 제거 후 텍스트만 남긴다 */
function stripTags(html) {
  return String(html == null ? '' : html)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * 경기 셀 HTML을 파싱한다.
 * 예: <span>LG</span><em><span class="lose">4</span><span>vs</span><span class="win">7</span></em><span>KT</span>
 * 취소 경기: <span>삼성</span><em><span>vs</span></em><span>롯데</span>
 */
function parsePlayCell(html) {
  const source = String(html == null ? '' : html);
  const spans = [];
  const spanRe = /<span(?:\s+class="([^"]*)")?\s*>([\s\S]*?)<\/span>/g;
  let m;
  while ((m = spanRe.exec(source)) !== null) {
    spans.push({ cls: m[1] || '', text: stripTags(m[2]) });
  }
  if (spans.length === 0) return null;

  const awayTeam = spans[0] ? spans[0].text : '';
  const homeTeam = spans[spans.length - 1] ? spans[spans.length - 1].text : '';

  // 가운데 요소들 중 숫자만 점수로 취급 ('vs'는 제외)
  const middle = spans.slice(1, -1);
  const scores = middle.filter((s) => /^\d+$/.test(s.text));

  if (scores.length < 2) {
    // 점수가 없음 = 미개최(취소/예정)
    return { awayTeam, homeTeam, awayScore: null, homeScore: null, played: false };
  }
  return {
    awayTeam,
    homeTeam,
    awayScore: Number(scores[0].text),
    homeScore: Number(scores[1].text),
    played: true,
  };
}

/** gameId(예: 20260801LGOB0)에서 날짜(20260801)를 뽑는다 */
function extractGameDate(cells) {
  for (const cell of cells) {
    const m = /gameDate=(\d{8})/.exec(String(cell.Text || ''));
    if (m) return m[1];
  }
  return null;
}

/**
 * KBO 응답의 rows를 평평한 경기 배열로 변환한다.
 * 첫 셀에 날짜(rowspan)가 있는 행이 그 날짜 그룹의 시작이고,
 * 이후 행들은 날짜 셀 없이 시간부터 시작한다.
 */
function normalizeRows(rows, seasonYear) {
  const games = [];
  let currentDateLabel = null;
  let currentMonthDay = null;

  for (const rowObj of rows) {
    const cells = rowObj.row || [];
    if (cells.length === 0) continue;

    let idx = 0;
    const firstCls = cells[0].Class || '';
    if (firstCls === 'day') {
      currentDateLabel = stripTags(cells[0].Text); // 예: "08.01(토)"
      const md = /(\d{2})\.(\d{2})/.exec(currentDateLabel);
      currentMonthDay = md ? `${md[1]}${md[2]}` : null;
      idx = 1;
    }

    const timeCell = cells[idx];
    const playCell = cells[idx + 1];
    if (!playCell || (playCell.Class || '') !== 'play') continue;

    const parsed = parsePlayCell(playCell.Text);
    if (!parsed) continue;

    // 구장/비고는 뒤에서부터 찾는다 (열 구성이 행마다 조금씩 달라서)
    const tailTexts = cells.slice(idx + 2).map((c) => stripTags(c.Text));
    const note = tailTexts.length > 0 ? tailTexts[tailTexts.length - 1] : '';
    const stadium = tailTexts.length > 1 ? tailTexts[tailTexts.length - 2] : '';

    const gameDate = extractGameDate(cells) || (currentMonthDay ? `${seasonYear}${currentMonthDay}` : null);

    games.push({
      date: gameDate, // YYYYMMDD
      dateLabel: currentDateLabel, // "08.01(토)"
      time: stripTags(timeCell ? timeCell.Text : ''),
      awayTeam: parsed.awayTeam,
      homeTeam: parsed.homeTeam,
      awayScore: parsed.awayScore,
      homeScore: parsed.homeScore,
      played: parsed.played,
      stadium,
      note: note === '-' ? '' : note, // '폭염취소', '우천취소' 등
    });
  }

  return games;
}

function todayInKST() {
  // KST(UTC+9) 기준 오늘 날짜를 YYYYMMDD로
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

module.exports = async function handler(req, res) {
  const date = String((req.query && req.query.date) || '').trim();

  if (!/^\d{8}$/.test(date)) {
    res.status(400).json({ error: 'date 파라미터가 필요합니다 (YYYYMMDD 형식).' });
    return;
  }

  const seasonId = date.slice(0, 4);
  const gameMonth = date.slice(4, 6);

  try {
    const body = new URLSearchParams({
      leId: '1',
      srIdList: '0,9,6',
      seasonId,
      gameMonth,
      teamId: '',
    }).toString();

    const kboRes = await fetch(KBO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        // KBO 서버가 일반 브라우저 요청으로 인식하도록
        'User-Agent': 'Mozilla/5.0 (compatible; meme-card-maker/1.0)',
        Referer: 'https://www.koreabaseball.com/schedule/schedule.aspx',
      },
      body,
    });

    if (!kboRes.ok) {
      res.status(502).json({ error: `KBO 응답 오류 (${kboRes.status})` });
      return;
    }

    const json = await kboRes.json();
    const parsed = typeof json.d === 'string' ? JSON.parse(json.d) : json;
    const allGames = normalizeRows(parsed.rows || [], seasonId);
    const games = allGames.filter((g) => g.date === date);

    // 캐시: 과거 날짜는 결과가 확정이므로 길게, 오늘/미래는 짧게
    const isPast = date < todayInKST();
    const maxAge = isPast ? 86400 : 600;
    res.setHeader('Cache-Control', `public, s-maxage=${maxAge}, stale-while-revalidate=86400`);
    res.status(200).json({ date, count: games.length, games });
  } catch (err) {
    // 상세 사유는 서버 로그로만 남긴다 (내부 구현 정보를 클라이언트에 노출하지 않음)
    console.error('[kbo-schedule] 예외', err);
    res.status(500).json({ error: 'KBO 데이터를 가져오지 못했습니다.' });
  }
};
