// Chọn quy tắc trả lời tự động. Hàm thuần, có test ở auto-reply.spec.ts.
import { boDau, coCumTu } from './text';

export type RuleInput = {
  id: string;
  name: string;
  type: 'FIRST_MESSAGE' | 'KEYWORD' | 'OFF_HOURS';
  keywords: string[];
  body: string;
  channels: string[];
  enabled: boolean;
};

export type Context = {
  channel: string;
  text: string;
  isFirstMessage: boolean;
  isOffHours: boolean;
  /** Tên các quy tắc ngoài giờ đã gửi gần đây, tránh lặp mỗi câu. */
  recentRuleNames: string[];
};

const BAC: Record<RuleInput['type'], number> = { FIRST_MESSAGE: 0, KEYWORD: 1, OFF_HOURS: 2 };

export function khopTuKhoa(rule: Pick<RuleInput, 'keywords'>, text: string): boolean {
  const t = boDau(text.normalize('NFC')).toLowerCase();
  return rule.keywords.some((k) => {
    const c = boDau(k).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return !!c && coCumTu(t, c);
  });
}

export function chonQuyTac<T extends RuleInput>(rules: T[], ctx: Context): T | null {
  const hopLe = rules
    .filter((r) => r.enabled && r.channels.includes(ctx.channel))
    .sort((a, b) => BAC[a.type] - BAC[b.type]);
  for (const r of hopLe) {
    if (r.type === 'FIRST_MESSAGE' && ctx.isFirstMessage) return r;
    if (r.type === 'KEYWORD' && khopTuKhoa(r, ctx.text)) return r;
    if (r.type === 'OFF_HOURS' && ctx.isOffHours && !ctx.recentRuleNames.includes(r.name)) return r;
  }
  return null;
}

/** Giờ làm việc theo giờ Việt Nam, ví dụ 8 đến 17.5 (17:30). */
export function ngoaiGioLamViec(now: Date, batDau: number, ketThuc: number): boolean {
  const vn = new Date(now.getTime() + 7 * 3600_000);
  const gio = vn.getUTCHours() + vn.getUTCMinutes() / 60;
  return gio < batDau || gio >= ketThuc;
}
