import { CHANNEL, thoiLuong, vnd } from '@/lib/labels';
import type { Channel, StatsBoard } from '@/lib/types';
import { BANG_MAU, ChartCard, Donut, Empty, Funnel, HBars, Heatmap, Kpi, Legend, MAU, MAU_KENH, Scatter, TimeChart, Waterfall, phanTram, so, tienGon } from './BoardCharts';

/** Các tab của trang Thống kê. Mỗi biểu đồ là một thẻ chiếm cả hàng, theo thiết kế Stitch đã duyệt. */

const KENH: Channel[] = ['ZALO', 'WEB', 'APP', 'FACEBOOK'];
const coKenh = (b: StatsBoard, ch: Channel) => b.customers.byChannelTotal[ch] > 0 || b.channels.conversationsSeries[ch].some(Boolean) || b.revenue.byChannel[ch] > 0;
const tenKenh = (ch: Channel) => CHANNEL[ch].label;
const delta = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : null);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const phut = (s: number) => `${(s / 60).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ph`;

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">{children}</div>;
}

// ================================================================ Khách & Quan tâm

export function CustomersTab({ b }: { b: StatsBoard }) {
  const c = b.customers;
  const labels = b.buckets.map((x) => x.label);
  const kenh = KENH.filter((k) => coKenh(b, k));
  return (
    <>
      <Grid>
        <Kpi label="Khách nhắn tin" value={so(c.total)} note="Khách có tin nhắn trong kỳ" />
        <Kpi label="Khách mới" value={so(c.newCustomers)} note={`${phanTram(c.total ? c.newCustomers / c.total : null)} tổng khách`} tone="blue" />
        <Kpi label="Để lại SĐT" value={so(c.phones)} note={`Tỷ lệ ${phanTram(c.total ? c.phones / c.total : null)}`} />
        <Kpi label="Cần gặp nhân viên" value={so(c.contacts)} note="Lượt khách đòi gặp người" tone="red" />
        <Kpi label="Tỷ lệ chốt" value={phanTram(c.total ? c.converted / c.total : null)} note={`${so(c.converted)} khách đã chốt tour`} tone="green" />
      </Grid>

      <ChartCard title="Khách nhắn tin theo ngày" description={`Số khách nhắn theo từng kênh (tính theo ngày nhắn gần nhất của khách)${b.granularity === 'week' ? ', gộp theo tuần' : ''}`} legend={<Legend items={kenh.map((k) => ({ label: tenKenh(k), color: MAU_KENH[k] }))} />}>
        <TimeChart labels={labels} series={kenh.map((k) => ({ name: tenKenh(k), color: MAU_KENH[k], values: c.byChannelSeries[k] }))} highlightLast />
      </ChartCard>

      <ChartCard title="Khách mới và khách quay lại" description="Khách lần đầu nhắn tin so với khách đã từng nhắn trước đó" legend={<Legend items={[{ label: `Khách mới (${phanTram(sum(c.newSeries) / Math.max(1, sum(c.newSeries) + sum(c.returningSeries)))})`, color: MAU.red }, { label: 'Khách quay lại', color: MAU.slate }]} />}>
        <TimeChart kind="stack-area" labels={labels} series={[{ name: 'Khách mới', color: MAU.red, values: c.newSeries }, { name: 'Khách quay lại', color: MAU.slate, values: c.returningSeries }]} />
      </ChartCard>

      <ChartCard title="Khách theo kênh" description="Tỷ trọng khách của từng kênh trong kỳ">
        <Donut center={so(c.total)} centerLabel="Tổng khách" items={kenh.map((k) => ({ label: tenKenh(k), value: c.byChannelTotal[k], color: MAU_KENH[k] }))} />
      </ChartCard>

      <ChartCard title="Phễu chuyển đổi" description="Cùng nhóm khách nhắn tin trong kỳ, từ lúc nhắn đến khi chốt tour" legend={<span className="rounded-md bg-green-soft px-2 py-1 font-semibold text-green-ink">Tỷ lệ chốt: {phanTram(c.total ? c.converted / c.total : null)}</span>}>
        <Funnel steps={[
          { label: 'Nhắn tin', value: c.total, note: 'Khách có tin trong kỳ' },
          { label: 'Để lại số điện thoại', value: c.phones },
          { label: 'Quan tâm tour', value: c.interested },
          { label: 'Đã chốt tour', value: c.converted },
        ]} />
        <p className="mt-3 text-xs text-muted">"Quan tâm tour" là khách được sale ghim tour quan tâm hoặc tự hỏi một địa điểm trong kỳ.</p>
      </ChartCard>

      <ChartCard title="Giờ khách cần nhân viên nhiều nhất" description="Số lượt khách đòi gặp nhân viên theo giờ và thứ trong tuần (giờ Việt Nam), dùng để xếp ca trực">
        <Heatmap cells={c.contactHeatmap} />
      </ChartCard>

      <ChartCard title="Địa điểm khách hỏi nhiều nhất" description={`Top 10 địa điểm khách tự nhắc trong tin nhắn · ${so(c.totalAsks)} lượt hỏi`}>
        <HBars rows={c.places.map((p) => ({ label: p.place, value: p.asks, detail: `(${phanTram(c.totalAsks ? p.asks / c.totalAsks : null)}) · ${so(p.customers)} khách` }))} />
      </ChartCard>
    </>
  );
}

// ================================================================ Tour

export function ToursTab({ b }: { b: StatsBoard }) {
  const t = b.tours;
  const r = b.revenue;
  const labels = b.buckets.map((x) => x.label);
  const sold = t.rows.filter((x) => x.orders > 0);
  const interestTotal = t.rows.reduce((a, x) => a + x.interested, 0);
  const bubble = t.rows.filter((x) => x.interested > 0 || x.orders > 0).slice(0, 15);
  return (
    <>
      <Grid>
        <Kpi label="Tour có khách quan tâm" value={so(t.interestedTours)} note="Tour được sale ghim trong kỳ" />
        <Kpi label="Đơn đã chốt" value={so(r.deals)} note={`${so(sold.length)} tour khác nhau`} tone="red" />
        <Kpi label="Hành khách" value={so(r.guests)} note="Số người trên đơn đã chốt" tone="blue" />
        <Kpi label="Giá trị TB / đơn" value={r.deals ? tienGon(r.total / r.deals) : '—'} note="Doanh thu / số đơn" />
        <Kpi label="Tỷ lệ quan tâm → chốt" value={phanTram(interestTotal ? Math.min(1, r.deals / interestTotal) : null)} note={`${so(interestTotal)} lượt khách quan tâm`} tone="green" />
      </Grid>

      <ChartCard title="Top 10 tour theo doanh thu" description="Doanh thu từ đơn đã chốt và số đơn của từng tour" legend={<Legend items={[{ label: 'Doanh thu', color: MAU.red }]} />}>
        <HBars rows={sold.slice(0, 10).map((x) => ({ label: x.name, value: x.revenue, detail: `· ${so(x.orders)} đơn` }))} format={tienGon} />
      </ChartCard>

      <ChartCard title="Quan tâm và chốt theo tour" description="Mỗi bong bóng là một tour: ngang là số khách quan tâm, dọc là số đơn chốt, bóng càng to doanh thu càng cao">
        <Scatter xLabel="Khách quan tâm" yLabel="Đơn chốt" points={bubble.map((x, i) => ({ label: x.name, x: x.interested, y: x.orders, r: x.revenue, color: BANG_MAU[i % BANG_MAU.length], detail: `Doanh thu: ${tienGon(x.revenue)}` }))} />
      </ChartCard>

      <ChartCard title="Quan tâm và chốt theo địa điểm" description="Khách quan tâm (sale ghim) và đơn chốt theo địa điểm của tour" legend={<Legend items={[{ label: 'Khách quan tâm', color: MAU.slate }, { label: 'Đơn chốt', color: MAU.red }]} />}>
        {t.byPlace.length ? (
          <TimeChart kind="bar" minPer={80} labels={t.byPlace.map((p) => p.place)} series={[{ name: 'Khách quan tâm', color: MAU.slate, values: t.byPlace.map((p) => p.interested) }, { name: 'Đơn chốt', color: MAU.red, values: t.byPlace.map((p) => p.orders) }]} />
        ) : <Empty />}
      </ChartCard>

      <ChartCard title="Số khách mỗi đơn" description={`Phân bố quy mô đoàn trên ${so(r.deals)} đơn đã chốt`}>
        {r.deals ? (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {t.guestsPerDeal.labels.map((lb, i) => {
              const v = t.guestsPerDeal.counts[i];
              const top = v === Math.max(...t.guestsPerDeal.counts) && v > 0;
              return (
                <div key={lb} className={`rounded-xl border p-4 ${top ? 'border-brand/40 bg-brand-faint' : 'border-line bg-page'}`}>
                  <div className="flex items-center justify-between text-xs"><span className="font-semibold text-ink">{lb}</span>{top && <span className="rounded bg-brand-button px-1.5 py-0.5 text-[0.625rem] font-bold text-white">PHỔ BIẾN</span>}</div>
                  <strong className={`mt-2 block text-xl font-bold ${top ? 'text-brand-text' : 'text-ink'}`}>{so(v)} đơn</strong>
                  <span className="text-xs text-muted">{phanTram(v / r.deals)} tổng đơn</span>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-fill"><div className="h-full rounded-full bg-brand" style={{ width: `${(v / r.deals) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        ) : <Empty />}
      </ChartCard>

      <ChartCard title={b.granularity === 'week' ? 'Đơn chốt theo tuần' : 'Đơn chốt theo ngày'} description="Số đơn chốt (cột) kèm số hành khách (đường, trục phải)" legend={<Legend items={[{ label: 'Số đơn chốt', color: MAU.red }, { label: 'Hành khách', color: MAU.slate }]} />}>
        <TimeChart kind="bar" labels={labels} series={[{ name: 'Đơn chốt', color: MAU.red, values: r.dealSeries }]} overlay={{ name: 'Hành khách', color: 'var(--color-ink)', values: r.guestSeries }} highlightLast />
      </ChartCard>

      <ChartCard title="Lịch khởi hành sắp tới" description="Số hành khách trên đơn đã chốt theo tuần khởi hành, 8 tuần tới">
        {t.upcoming.some((u) => u.guests) ? (
          <TimeChart labels={t.upcoming.map((u, i) => `Tuần ${i + 1} (${u.week.slice(8, 10)}/${u.week.slice(5, 7)})`)} minPer={90} series={[{ name: 'Hành khách', color: MAU.red, values: t.upcoming.map((u) => u.guests), area: true }]} />
        ) : <Empty>Chưa có đơn đã chốt khởi hành trong 8 tuần tới (đơn cần có ngày khởi hành).</Empty>}
      </ChartCard>
    </>
  );
}

// ================================================================ Hiệu suất sale

export function SalesTab({ b, onSelect }: { b: StatsBoard; onSelect: (id: string) => void }) {
  const s = b.sales;
  const labels = b.buckets.map((x) => x.label);
  const rows = s.rows;
  const color = new Map(rows.map((r, i) => [r.id, BANG_MAU[i % BANG_MAU.length]]));
  const totalDeals = rows.reduce((a, r) => a + r.deals, 0);
  const totalConv = rows.reduce((a, r) => a + r.conversations, 0);
  const top6 = rows.filter((r) => r.responses > 0).slice(0, 6);
  return (
    <>
      <Grid>
        <Kpi label="Phản hồi trung vị" value={thoiLuong(s.medianSeconds)} note={`${so(s.responses)} lượt khách cần nhân viên`} tone="blue" />
        <Kpi label="Trả lời trong 5 phút" value={phanTram(s.within5MinRate)} note="Trên các lượt đã phản hồi" tone="green" />
        <Kpi label="Hội thoại đã xử lý" value={so(totalConv)} note="Khách có nhân viên phụ trách" />
        <Kpi label="Đơn sale chốt" value={so(totalDeals)} note={`${so(rows.filter((r) => r.onDuty && r.isActive).length)} sale đang trực`} tone="red" />
        <Kpi label="Tỷ lệ chốt" value={phanTram(totalConv ? Math.min(1, totalDeals / totalConv) : null)} note="Đơn chốt / hội thoại xử lý" />
      </Grid>

      <ChartCard title="Hội thoại xử lý và đơn chốt theo sale" description="So sánh khối lượng tư vấn với kết quả chốt của từng sale" legend={<Legend items={[{ label: 'Hội thoại xử lý', color: MAU.slate }, { label: 'Đơn chốt', color: MAU.red }]} />}>
        {rows.length ? <TimeChart kind="bar" minPer={90} labels={rows.map((r) => r.name)} series={[{ name: 'Hội thoại xử lý', color: MAU.slate, values: rows.map((r) => r.conversations) }, { name: 'Đơn chốt', color: MAU.red, values: rows.map((r) => r.deals) }]} /> : <Empty>Chưa có sale trong phạm vi này.</Empty>}
      </ChartCard>

      <ChartCard title="Phân bố thời gian phản hồi" description="Thời gian từ lúc khách đòi gặp nhân viên đến khi được trả lời (mục tiêu dưới 5 phút)">
        {s.responses ? <TimeChart kind="bar" minPer={90} labels={s.responseHistogram.labels} series={[{ name: 'Số lượt', color: MAU.green, values: s.responseHistogram.counts }]} /> : <Empty>Chưa có lượt khách cần nhân viên được phản hồi trong kỳ.</Empty>}
      </ChartCard>

      <ChartCard title={`Thời gian phản hồi trung vị theo ${b.granularity === 'week' ? 'tuần' : 'ngày'}`} description="Đường đỏ đậm là cả nhóm, các đường mảnh là từng sale; mốc không có lượt nào để trống" legend={<Legend items={[{ label: 'Cả nhóm', color: MAU.red }, ...top6.map((r) => ({ label: r.name, color: color.get(r.id)!, dashed: true }))]} />}>
        <TimeChart labels={labels} format={phut} series={[{ name: 'Cả nhóm', color: MAU.red, values: s.medianSeries }, ...top6.map((r) => ({ name: r.name, color: color.get(r.id)!, values: r.medianSeries, dashed: true }))]} highlightLast />
      </ChartCard>

      <ChartCard title="Khối lượng và tỷ lệ chốt" description="Mỗi điểm là một sale: ngang là số hội thoại xử lý, dọc là tỷ lệ chốt, bóng to là doanh thu">
        <Scatter xLabel="Hội thoại xử lý" yLabel="Tỷ lệ chốt" formatY={(v) => phanTram(v, 0)} points={rows.filter((r) => r.conversations > 0).map((r) => ({ label: r.name, x: r.conversations, y: r.closeRate ?? 0, r: r.revenue, color: color.get(r.id), detail: `${so(r.deals)} đơn · ${tienGon(r.revenue)}` }))} />
      </ChartCard>

      <ChartCard title="Tỷ trọng đơn chốt theo sale" description={`Phân bố ${so(totalDeals)} đơn sale đã chốt trong kỳ`}>
        <Donut center={so(totalDeals)} centerLabel="Đơn chốt" items={rows.filter((r) => r.deals > 0).map((r) => ({ label: r.name, value: r.deals, color: color.get(r.id)!, detail: tienGon(r.revenue) }))} />
      </ChartCard>

      <ChartCard title="Bảng xếp hạng sale" description="Bấm một dòng để xem chi tiết và danh sách đơn của sale đó">
        {rows.length ? (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-3 py-2 font-medium">Hạng</th>
                  <th className="px-3 py-2 font-medium">Nhân viên</th>
                  <th className="px-3 py-2 text-right font-medium">Hội thoại</th>
                  <th className="px-3 py-2 text-right font-medium">Phản hồi TV</th>
                  <th className="px-3 py-2 font-medium">Trong 5 phút</th>
                  <th className="px-3 py-2 text-right font-medium">Đơn chốt</th>
                  <th className="px-3 py-2 text-right font-medium">Doanh thu</th>
                  <th className="px-3 py-2 font-medium">Tỷ lệ chốt</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} onClick={() => onSelect(r.id)} className="cursor-pointer border-b border-line-soft hover:bg-fill">
                    <td className="px-3 py-3"><span className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-brand-button text-white' : 'bg-fill text-body'}`}>{i + 1}</span></td>
                    <td className="px-3 py-3">
                      <button type="button" className="text-left font-semibold text-ink hover:underline" onClick={(e) => { e.stopPropagation(); onSelect(r.id); }}>{r.name}</button>
                      <div className="text-xs text-muted">{[r.employeeCode, r.position ?? r.departmentName].filter(Boolean).join(' · ') || '—'}</div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{so(r.conversations)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{thoiLuong(r.medianSeconds)}</td>
                    <td className="px-3 py-3">{r.within5MinRate == null ? <span className="text-muted">—</span> : <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.within5MinRate >= 0.8 ? 'bg-green-soft text-green-ink' : 'bg-amber-soft text-amber-ink'}`}>{phanTram(r.within5MinRate, 0)} {r.within5MinRate >= 0.8 ? 'Đạt' : 'Cần cải thiện'}</span>}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-brand-text">{so(r.deals)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{vnd(r.revenue)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-fill"><div className="h-full rounded-full bg-brand" style={{ width: `${(r.closeRate ?? 0) * 100}%` }} /></div><span className="text-xs tabular-nums">{phanTram(r.closeRate)}</span></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>Chưa có sale trong phạm vi này.</Empty>}
      </ChartCard>
    </>
  );
}

// ================================================================ Doanh thu đã chốt

export function RevenueTab({ b, orders }: { b: StatsBoard; orders: React.ReactNode }) {
  const r = b.revenue;
  const labels = b.buckets.map((x) => x.label);
  const kenh = KENH.filter((k) => r.byChannel[k] > 0);
  return (
    <>
      {r.pending.count > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-line bg-amber-soft px-4 py-3 text-sm text-amber-ink">
          <strong>{so(r.pending.count)} đơn đang chờ xác nhận</strong>
          <span>· {vnd(r.pending.amount)}, chưa tính vào doanh thu (mọi thời gian)</span>
        </div>
      )}
      <Grid>
        <Kpi label="Doanh thu đã chốt" value={tienGon(r.total)} delta={delta(r.total, r.prevTotal)} note="So với kỳ trước cùng độ dài" tone="red" />
        <Kpi label="Số đơn" value={so(r.deals)} note={`${so(r.guests)} hành khách`} />
        <Kpi label="Giá trị TB / đơn" value={r.deals ? tienGon(r.total / r.deals) : '—'} note="Doanh thu / số đơn" />
        <Kpi label="Voucher đã giảm" value={tienGon(r.discount)} note={`${phanTram(r.gross ? r.discount / r.gross : null)} giá tour gốc`} tone="blue" />
        <Kpi label="Đơn huỷ / mở lại" value={so(r.cancelled.count)} note={tienGon(r.cancelled.amount)} />
      </Grid>

      <ChartCard title={`Doanh thu theo ${b.granularity === 'week' ? 'tuần' : 'ngày'}`} description="Doanh thu đã chốt kỳ này so với kỳ liền trước cùng độ dài" legend={<Legend items={[{ label: 'Kỳ này', color: MAU.red }, { label: 'Kỳ trước', color: MAU.slate, dashed: true }]} />}>
        <TimeChart labels={labels} format={tienGon} series={[{ name: 'Kỳ này', color: MAU.red, values: r.series, area: true }, { name: 'Kỳ trước', color: MAU.slate, values: r.prevSeries, dashed: true }]} highlightLast />
      </ChartCard>

      <ChartCard title="Doanh thu theo kênh" description="Tỷ trọng doanh thu đã chốt từ từng kênh khách nhắn">
        <Donut center={tienGon(r.total)} centerLabel="Tổng doanh thu" format={tienGon} items={kenh.map((k) => ({ label: tenKenh(k), value: r.byChannel[k], color: MAU_KENH[k] }))} />
      </ChartCard>

      {r.byDepartment.length > 0 && (
        <ChartCard title="Doanh thu theo phòng ban" description="Cột chồng theo phòng của người phụ trách khách" legend={<Legend items={r.byDepartment.map((d, i) => ({ label: d.name, color: BANG_MAU[i % BANG_MAU.length] }))} />}>
          <TimeChart kind="stack-bar" labels={labels} format={tienGon} series={r.byDepartment.map((d, i) => ({ name: d.name, color: BANG_MAU[i % BANG_MAU.length], values: d.series }))} />
        </ChartCard>
      )}

      <ChartCard title="Từ giá tour đến doanh thu" description="Tổng giá tour của các đơn, trừ voucher, ra doanh thu đã chốt">
        <Waterfall steps={[{ label: 'Giá tour', value: r.gross, kind: 'total' }, { label: 'Voucher', value: r.discount, kind: 'minus' }, { label: 'Doanh thu', value: r.total, kind: 'total' }]} />
      </ChartCard>

      <ChartCard title="Phân bố giá trị đơn" description="Số đơn theo khoảng giá trị">
        {r.deals ? <TimeChart kind="bar" minPer={80} labels={r.valueHistogram.labels} series={[{ name: 'Số đơn', color: MAU.blue, values: r.valueHistogram.counts }]} /> : <Empty />}
      </ChartCard>

      <ChartCard title="10 khách chi nhiều nhất" description="Tổng tiền đơn đã chốt trong kỳ">
        <HBars rows={r.topCustomers.map((c) => ({ label: c.name, value: c.revenue, detail: `· ${so(c.orders)} đơn, ${so(c.guests)} khách` }))} format={tienGon} />
      </ChartCard>

      {orders}
    </>
  );
}

// ================================================================ Kênh & Chi phí AI

export function ChannelsTab({ b, status }: { b: StatsBoard; status: React.ReactNode }) {
  const ch = b.channels;
  const labels = b.buckets.map((x) => x.label);
  const kenh = KENH.filter((k) => coKenh(b, k));
  const totalConv = ch.botConversations + ch.staffConversations;
  const costItems = [...kenh.map((k) => ({ label: tenKenh(k), value: ch.costByChannel[k], color: MAU_KENH[k] })), { label: 'Không gắn hội thoại', value: ch.costByChannel.OTHER, color: MAU.slate }].filter((x) => x.value > 0);
  return (
    <>
      <Grid>
        <Kpi label="Bot tự xử lý" value={phanTram(totalConv ? ch.botConversations / totalConv : null)} note={`${so(ch.botConversations)} / ${so(totalConv)} hội thoại`} tone="green" />
        <Kpi label="Có nhân viên" value={phanTram(totalConv ? ch.staffConversations / totalConv : null)} note={`${so(ch.staffConversations)} hội thoại có người phụ trách`} />
        <Kpi label="Chi phí Gemini (ước tính)" value={tienGon(ch.cost)} note={`${tienGon(ch.tokens)} token`} tone="red" />
        <Kpi label="Chi phí / hội thoại" value={ch.botConversations + ch.staffConversations ? vnd(ch.cost / totalConv) : '—'} note="Chi phí chia số hội thoại" />
        <Kpi label="Hội thoại mới" value={so(sum(kenh.flatMap((k) => ch.conversationsSeries[k])))} note="Hội thoại bắt đầu trong kỳ" tone="blue" />
      </Grid>

      <ChartCard title="Hội thoại mới theo kênh" description="Số hội thoại bắt đầu trong từng mốc, chồng theo kênh" legend={<Legend items={kenh.map((k) => ({ label: tenKenh(k), color: MAU_KENH[k] }))} />}>
        <TimeChart kind="stack-bar" labels={labels} series={kenh.map((k) => ({ name: tenKenh(k), color: MAU_KENH[k], values: ch.conversationsSeries[k] }))} />
      </ChartCard>

      <ChartCard title="Ai lo khách" description="Tỷ lệ hội thoại chỉ có bot so với hội thoại có nhân viên phụ trách (theo ngày khách nhắn gần nhất)" legend={<Legend items={[{ label: 'Bot tự xử lý', color: MAU.blue }, { label: 'Có nhân viên', color: MAU.red }]} />}>
        <TimeChart kind="percent" labels={labels} series={[{ name: 'Bot tự xử lý', color: MAU.blue, values: ch.botSeries }, { name: 'Có nhân viên', color: MAU.red, values: ch.staffSeries }]} />
      </ChartCard>

      <ChartCard title={`Chi phí Gemini theo ${b.granularity === 'week' ? 'tuần' : 'ngày'}`} description="Chi phí (cột) và số token (đường, trục phải). Chi phí = token ghi nhận × giá cấu hình, là số ước tính" legend={<Legend items={[{ label: 'Chi phí', color: MAU.red }, { label: 'Token', color: MAU.slate }]} />}>
        <TimeChart kind="bar" labels={labels} format={tienGon} series={[{ name: 'Chi phí', color: MAU.red, values: ch.costSeries }]} overlay={{ name: 'Token', color: 'var(--color-ink)', values: ch.tokenSeries }} overlayFormat={tienGon} highlightLast />
      </ChartCard>

      <ChartCard title="Chi phí AI theo kênh" description="Cơ cấu chi phí Gemini theo kênh của hội thoại">
        <Donut center={tienGon(ch.cost)} centerLabel="Tổng chi phí" format={(v) => vnd(v)} items={costItems} />
      </ChartCard>

      {status}
    </>
  );
}
