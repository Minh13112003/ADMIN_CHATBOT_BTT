import { useState } from 'react';
import useSWR from 'swr';
import { Segmented } from '@/components/ui';
import { StatsCharts } from '@/components/stats/StatsCharts';
import { fetcher } from '@/lib/api';
import { CHANNEL, CHANNEL_LIST, dinhDangSo, thoiLuong, trieu, vnd } from '@/lib/labels';
import type { Stats } from '@/lib/types';

type Period = 'today' | 'week' | 'month' | 'all';
const so = (n: number) => n.toLocaleString('vi-VN');
const tok = (n: number) => (n < 1e6 ? so(n) : `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} triệu`);
const pct = (n: number, tong: number) => (tong ? `${((n / tong) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%` : '0%');

export default function StatsPage() {
  const [period, setPeriod] = useState<Period>('month');
  // Backend chỉ tính lại mỗi 5 phút, nên trang cũng làm mới theo nhịp đó.
  const { data: s, error } = useSWR<Stats>(`/stats?period=${period}`, fetcher, { refreshInterval: 5 * 60_000 });

  return (
    <section className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-6 px-8 py-6 max-[1199px]:px-6 max-md:gap-5 max-md:px-4 max-md:py-5 [&_table_thead]:bg-fill [&_table_thead]:text-xs [&_table_th]:whitespace-nowrap [&_table_td]:py-[18px] stats-page">
      <div className="flex flex-wrap items-center gap-2.5">
        <header className="flex flex-wrap items-center justify-between gap-5 [&_.eyebrow]:hidden [&_h1]:hidden [&_p]:mt-0 [&_p]:max-w-[660px] [&_p]:text-sm [&_p]:leading-[1.65] [&_p]:text-muted min-w-48 flex-1">
          <div>
            <p className="eyebrow">HIỆU QUẢ KINH DOANH</p>
            <h1>Báo cáo hiệu suất kinh doanh &amp; hội thoại đa kênh</h1>
            <p>Theo dõi lượng khách, yêu cầu tư vấn, đơn tour và doanh thu trong kỳ.</p>
          </div>
        </header>
        <Segmented
          label="Khoảng thời gian"
          value={period}
          onChange={setPeriod}
          items={[
            { key: 'today', label: 'Hôm nay' },
            { key: 'week', label: '7 ngày' },
            { key: 'month', label: 'Tháng này' },
            { key: 'all', label: 'Tất cả' },
          ]}
        />
      </div>

      {error && <p className="text-sm text-brand-text">Không tải được thống kê.</p>}
      {!s && !error && <p className="text-sm text-muted">Đang tải...</p>}
      {s && (
        <>
          <div className="grid grid-cols-5 gap-3 max-[1250px]:grid-cols-3 max-md:grid-cols-2 max-md:gap-2.5">
            <Kpi label="Khách nhắn tin" value={so(s.customers)} sub={`${so(s.phones)} người để lại số`} />
            <Kpi label="Số điện thoại để lại" value={so(s.phones)} sub={`${pct(s.phones, s.customers)} khách nhắn tin`} />
            <Kpi label="Yêu cầu gặp nhân viên" value={so(s.contact)} sub={s.contact ? `Phản hồi trung vị ${thoiLuong(s.responseTime.medianSeconds)}` : 'Chưa có yêu cầu trong kỳ'} />
            <Kpi label="Đơn đã chốt" value={so(s.closed)} sub={`${so(s.guests)} khách đi tour`} />
            <Kpi
              label="Doanh thu đã chốt"
              value={trieu(s.totalRevenue)}
              sub={s.pending.count ? `Chưa gồm ${s.pending.count} đơn chờ xác nhận` : 'Từ đơn đã chốt gắn hội thoại'}
            />
          </div>

          <StatsCharts period={period} />

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-2.5">
            <Card title="Doanh thu theo kênh">
              {CHANNEL_LIST.map((k) => (
                <Bar
                  key={k}
                  label={CHANNEL[k].label}
                  value={trieu(s.revenue[k])}
                  ratio={s.revenue[k] / Math.max(...CHANNEL_LIST.map((c) => s.revenue[c]), 1)}
                  tip={vnd(s.revenue[k])}
                  color="bg-brand"
                />
              ))}
            </Card>
            <Card title="Từ tin nhắn đến chốt tour">
              {(
                [
                  ['Khách nhắn tin', s.customers],
                  ['Để lại số điện thoại', s.phones],
                  ['Đòi gặp nhân viên', s.contact],
                  ['Chốt tour', s.closed],
                ] as const
              ).map(([l, n]) => (
                <Bar key={l} label={l} value={so(n)} ratio={s.customers ? n / s.customers : 0} tip={`${l}: ${so(n)}`} color="bg-ink" wide />
              ))}
            </Card>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-2.5">
            <Card title="Theo tour">
              <Table
                heads={['Tour', 'Đơn', 'Khách', 'Doanh thu']}
                rows={s.tours.map((t) => [t.name, so(t.orders), so(t.guests), trieu(t.revenue)])}
                empty="Chưa có đơn nào trong kỳ này."
              />
            </Card>
            <Card title="Theo người chốt">
              <Table
                heads={['Người chốt', 'Liên hệ', 'Trả lời TB', 'Chốt', 'Doanh thu']}
                rows={s.staff.map((t) => [t.name, so(t.contact), t.responses ? thoiLuong(t.avgSeconds) : 'Chưa có', so(t.closed), trieu(t.revenue)])}
                empty="Chưa có số liệu trong kỳ này."
              />
              <p className="text-xs text-muted">Trả lời TB: thời gian trung bình từ lúc khách đòi gặp nhân viên tới tin trả lời đầu tiên.</p>
            </Card>
          </div>

          <Card title="Khách chi nhiều nhất">
            {s.topCustomers.length ? (
              <ol className="flex flex-col">
                {s.topCustomers.map((k, i) => (
                  <li key={k.id} className="flex items-start gap-3 border-t border-line-soft py-2 text-[0.8125rem] first:border-t-0 first:pt-0">
                    <span className="w-5 shrink-0 text-right font-semibold tabular-nums text-muted">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="break-words font-medium">{k.name}</div>
                      <div className="text-muted">{k.phone ? dinhDangSo(k.phone) : 'Chưa có số điện thoại'}</div>
                      <div className="text-muted" title={k.channels.map((c) => `${CHANNEL[c.channel].label}: ${vnd(c.revenue)}`).join(', ')}>
                        {k.channels.map((c) => CHANNEL[c.channel].label).join(', ')}
                      </div>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <div className="font-semibold">{trieu(k.revenue)}</div>
                      <div className="text-muted">
                        {so(k.orders)} đơn · {so(k.guests)} khách
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">Chưa có đơn nào trong kỳ này.</p>
            )}
            <p className="text-xs text-muted">
              Cộng các đơn đã chốt ở mọi kênh, trừ đơn bị huỷ khi mở lại hội thoại. Chưa trừ đơn huỷ hoặc hoàn tiền bên hệ thống đặt tour.
            </p>
          </Card>

          <div className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface shadow-sm p-3.5">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="min-w-52 flex-1 text-[0.9375rem] font-semibold">Chi phí Gemini của bttAI</h3>
              <span className="text-xs text-muted">
                Cập nhật lúc {new Date(s.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · tự làm mới mỗi 5 phút
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
              <Mini label="Token vào" value={tok(s.gemini.inputTokens)} sub={`$${s.gemini.inputUsd.toFixed(2)}`} />
              <Mini label="Token ra" value={tok(s.gemini.outputTokens)} sub={`$${s.gemini.outputUsd.toFixed(2)}`} />
              <Mini label="Tổng chi phí" value={vnd(s.gemini.vnd)} sub={`$${s.gemini.usd.toFixed(2)}`} />
              <Mini label="Chi phí mỗi đơn chốt" value={s.closed ? vnd(s.gemini.vnd / s.closed) : 'Chưa có đơn'} sub={`${so(s.closed)} đơn`} />
            </div>
            <p className="text-xs text-muted">
              Số ước tính: token thật nhân giá ${s.gemini.priceInput} và ${s.gemini.priceOutput} mỗi 1 triệu token vào và ra, tỷ giá {so(s.gemini.usdVndRate)}{' '}
              đ/USD đặt trong cấu hình. Đối soát với hoá đơn Google cuối tháng.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-h-[152px] rounded-xl border border-line bg-surface shadow-sm p-[19px] max-md:p-3.5 last:border-l-4 last:border-l-brand [&>div:nth-child(2)]:mb-2 [&>div:nth-child(2)]:mt-3.5 [&>div:nth-child(2)]:text-[1.8rem] [&>div:nth-child(2)]:tracking-[-0.04em] max-md:[&>div:nth-child(2)]:text-[1.45rem]">
      <div className="text-[0.8125rem] text-body">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted">{sub}</div>
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-[0.8125rem] text-body">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{sub}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[14px] border border-line bg-surface shadow-sm p-3.5">
      <h3 className="mb-3 text-[0.9375rem] font-semibold">{title}</h3>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function Bar({ label, value, ratio, tip, color, wide }: { label: string; value: string; ratio: number; tip: string; color: string; wide?: boolean }) {
  return (
    <div
      title={tip}
      className={`grid items-center gap-2 text-[0.8125rem] ${wide ? 'grid-cols-[132px_minmax(0,1fr)_52px]' : 'grid-cols-[82px_minmax(0,1fr)_88px]'}`}
    >
      <span className="text-body">{label}</span>
      <span className="h-3 overflow-hidden rounded-r bg-fill">
        <span className={`block h-3 rounded-r ${color}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
      </span>
      <span className="text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}

function Table({ heads, rows, empty }: { heads: string[]; rows: string[][]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <table className="w-full border-collapse text-[0.8125rem] tabular-nums">
      <thead>
        <tr className="text-body">
          {heads.map((h, i) => (
            <th key={h} scope="col" className={`px-1 py-1.5 font-medium ${i ? 'text-right' : 'text-left'}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r[0]}>
            {r.map((v, i) => (
              <td key={i} className={`border-t border-line-soft px-1 py-1.5 ${i ? 'text-right' : ''}`}>
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
