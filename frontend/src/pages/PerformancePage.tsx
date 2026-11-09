import { useState } from "react";
import useSWR from "swr";
import { Segmented } from "@/components/ui";
import { fetcher } from "@/lib/api";
import { thoiLuong, vnd } from "@/lib/labels";
import type { Stats } from "@/lib/types";

type Period = "today" | "week" | "month" | "all";
export default function PerformancePage() {
  const [period, setPeriod] = useState<Period>("month");
  const { data, error, mutate } = useSWR<Stats>(
    `/stats?period=${period}`,
    fetcher,
  );
  const sales = data?.staff.filter((person) => person.isSale) ?? [];
  const totalResponses = sales.reduce((sum, person) => sum + person.responses, 0);
  const requests = sales.reduce((sum, person) => sum + person.contact, 0);
  const revenue = sales.reduce((sum, person) => sum + person.revenue, 0);
  const maxRevenue = Math.max(...sales.map((person) => person.revenue), 1);
  return (
    <main className="page-layout">
      <header className="page-heading">
        <div>
          <p className="eyebrow">QUẢN TRỊ ĐỘI NGŨ</p>
          <h1>Hiệu suất sale</h1>
          <p>Theo dõi phản hồi khách và đơn đã chốt theo nhân viên.</p>
        </div>
        <Segmented
          label="Thời gian"
          value={period}
          onChange={setPeriod}
          items={[
            { key: "today", label: "Hôm nay" },
            { key: "week", label: "7 ngày" },
            { key: "month", label: "Tháng này" },
            { key: "all", label: "Tất cả" },
          ]}
        />
      </header>
      {!data && !error && <p role="status">Đang tải hiệu suất...</p>}
      {error && (
        <p role="alert" className="text-brand-text">
          Không tải được hiệu suất.{" "}
          <button className="underline" onClick={() => void mutate()}>
            Thử lại
          </button>
        </p>
      )}
      {data && <div className="performance-kpis">
        <div className="performance-kpi"><span>Thời gian trả lời trung vị</span><strong>{thoiLuong(data.responseTime.medianSeconds)}</strong><small>{data.responseTime.count} lượt được ghi nhận</small></div>
        <div className="performance-kpi"><span>Tỷ lệ trả lời trong 5 phút</span><strong>{data.responseTime.within5MinRate === null ? "Chưa có" : `${Math.round(data.responseTime.within5MinRate * 100)}%`}</strong><small>Trên {data.responseTime.count} lượt cần tư vấn</small></div>
        <div className="performance-kpi"><span>Yêu cầu tư vấn</span><strong>{requests.toLocaleString("vi-VN")}</strong><small>{sales.filter((person) => person.onDuty).length} nhân viên đang trực</small></div>
        <div className="performance-kpi accent"><span>Doanh thu đã chốt</span><strong>{vnd(revenue)}</strong><small>{sales.reduce((sum, person) => sum + person.closed, 0)} đơn · {totalResponses} lượt trả lời</small></div>
      </div>}
      {data && sales.length === 0 && (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">
          Chưa có số liệu trong kỳ này.
        </p>
      )}
      {sales.length > 0 && <div className="performance-layout"><section className="performance-table"><h2>Bảng hiệu suất tư vấn viên <span>{sales.length} nhân viên</span></h2><div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="bg-fill text-left">
                <th className="p-4">#</th>
                <th className="p-4">Nhân viên</th>
                <th className="p-4">Đang trực</th>
                <th className="p-4">Đang giữ</th>
                <th className="p-4">Lượt trả lời</th>
                <th className="p-4">Trung vị</th>
                <th className="p-4">Trong 5 phút</th>
                <th className="p-4">Đơn chốt</th>
                <th className="p-4">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s, i) => (
                <tr key={s.name} className="border-t border-line-soft">
                  <td className="p-4"><span className="grid size-7 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-text">{i + 1}</span></td>
                  <td className="p-4 font-semibold"><span className="flex items-center gap-2.5"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-fill text-xs font-bold">{s.name.split(" ").slice(-2).map((w) => w[0]).join("").toUpperCase()}</span>{s.name}</span></td>
                  <td className="p-4">
                    {s.onDuty ? "Đang trực" : "Đang nghỉ"}
                  </td>
                  <td className="p-4">{s.load}</td>
                  <td className="p-4">{s.responses}</td>
                  <td className="p-4">{thoiLuong(s.medianSeconds)}</td>
                  <td className="p-4">{s.within5MinRate === null ? "Chưa có" : <span className="block min-w-24"><span className="font-semibold">{Math.round(s.within5MinRate * 100)}%</span><span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-fill"><span className="block h-full rounded-full bg-on" style={{ width: `${Math.round(s.within5MinRate * 100)}%` }} /></span></span>}</td>
                  <td className="p-4">{s.closed}</td>
                  <td className="p-4 font-semibold">{vnd(s.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></section><aside className="performance-revenue"><h2>Doanh thu theo sale</h2><p>Đóng góp trong kỳ đang chọn</p>{sales.map((person) => <div className="performance-bar-row" key={person.name}><div><span>{person.name}</span><strong>{vnd(person.revenue)}</strong></div><div className="performance-track"><span style={{width:`${Math.max(person.revenue / maxRevenue * 100, person.revenue ? 3 : 0)}%`}} /></div></div>)}{revenue === 0 && <p className="text-sm text-muted">Chưa ghi nhận doanh thu trong kỳ.</p>}</aside></div>}
    </main>
  );
}
