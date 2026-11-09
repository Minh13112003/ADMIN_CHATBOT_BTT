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
    <main className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-6 px-8 py-6 max-[1199px]:px-6 max-md:gap-5 max-md:px-4 max-md:py-5 [&_table_thead]:bg-fill [&_table_thead]:text-xs [&_table_th]:whitespace-nowrap [&_table_td]:py-[18px]">
      <header className="flex flex-wrap items-center justify-between gap-5 [&_.eyebrow]:hidden [&_h1]:hidden [&_p]:mt-0 [&_p]:max-w-[660px] [&_p]:text-sm [&_p]:leading-[1.65] [&_p]:text-muted">
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
      {data && <div className="grid grid-cols-4 gap-3.5 max-[1200px]:grid-cols-2 max-[700px]:grid-cols-1">
        <div className="flex min-h-[145px] flex-col justify-between rounded-[13px] border border-line bg-surface p-5 [&_span]:text-[0.85rem] [&_span]:text-muted [&_strong]:text-[clamp(1.4rem,2vw,2rem)] [&_strong]:leading-[1.2] [&_small]:text-[0.76rem] [&_small]:text-muted [&.accent_strong]:text-brand-text"><span>Thời gian trả lời trung vị</span><strong>{thoiLuong(data.responseTime.medianSeconds)}</strong><small>{data.responseTime.count} lượt được ghi nhận</small></div>
        <div className="flex min-h-[145px] flex-col justify-between rounded-[13px] border border-line bg-surface p-5 [&_span]:text-[0.85rem] [&_span]:text-muted [&_strong]:text-[clamp(1.4rem,2vw,2rem)] [&_strong]:leading-[1.2] [&_small]:text-[0.76rem] [&_small]:text-muted [&.accent_strong]:text-brand-text"><span>Tỷ lệ trả lời trong 5 phút</span><strong>{data.responseTime.within5MinRate === null ? "Chưa có" : `${Math.round(data.responseTime.within5MinRate * 100)}%`}</strong><small>Trên {data.responseTime.count} lượt cần tư vấn</small></div>
        <div className="flex min-h-[145px] flex-col justify-between rounded-[13px] border border-line bg-surface p-5 [&_span]:text-[0.85rem] [&_span]:text-muted [&_strong]:text-[clamp(1.4rem,2vw,2rem)] [&_strong]:leading-[1.2] [&_small]:text-[0.76rem] [&_small]:text-muted [&.accent_strong]:text-brand-text"><span>Yêu cầu tư vấn</span><strong>{requests.toLocaleString("vi-VN")}</strong><small>{sales.filter((person) => person.onDuty).length} nhân viên đang trực</small></div>
        <div className="flex min-h-[145px] flex-col justify-between rounded-[13px] border border-line bg-surface p-5 [&_span]:text-[0.85rem] [&_span]:text-muted [&_strong]:text-[clamp(1.4rem,2vw,2rem)] [&_strong]:leading-[1.2] [&_small]:text-[0.76rem] [&_small]:text-muted [&.accent_strong]:text-brand-text accent"><span>Doanh thu đã chốt</span><strong>{vnd(revenue)}</strong><small>{sales.reduce((sum, person) => sum + person.closed, 0)} đơn · {totalResponses} lượt trả lời</small></div>
      </div>}
      {data && sales.length === 0 && (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">
          Chưa có số liệu trong kỳ này.
        </p>
      )}
      {sales.length > 0 && <div className="grid grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] items-start gap-4 max-[1650px]:grid-cols-1"><section className="min-w-0 [&_h2]:mb-3.5 [&_h2]:text-[1.05rem] [&_h2]:font-bold [&_h2_span]:ml-2 [&_h2_span]:text-xs [&_h2_span]:font-medium [&_h2_span]:text-muted"><h2>Bảng hiệu suất tư vấn viên <span>{sales.length} nhân viên</span></h2><div className="overflow-x-auto rounded-xl border border-line bg-surface">
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
        </div></section><aside className="rounded-[13px] border border-line bg-surface p-5 [&_h2]:mb-3.5 [&_h2]:text-[1.05rem] [&_h2]:font-bold [&>p]:-mt-2 [&>p]:mb-[22px] [&>p]:text-[0.8rem] [&>p]:text-muted"><h2>Doanh thu theo sale</h2><p>Đóng góp trong kỳ đang chọn</p>{sales.map((person) => <div className="my-4 [&>div:first-child]:flex [&>div:first-child]:justify-between [&>div:first-child]:gap-2.5 [&>div:first-child]:text-[0.8rem] [&_strong]:whitespace-nowrap" key={person.name}><div><span>{person.name}</span><strong>{vnd(person.revenue)}</strong></div><div className="mt-[7px] h-2.5 overflow-hidden rounded-[10px] bg-fill [&_span]:block [&_span]:h-full [&_span]:rounded-[inherit] [&_span]:bg-brand-button"><span style={{width:`${Math.max(person.revenue / maxRevenue * 100, person.revenue ? 3 : 0)}%`}} /></div></div>)}{revenue === 0 && <p className="text-sm text-muted">Chưa ghi nhận doanh thu trong kỳ.</p>}</aside></div>}
    </main>
  );
}
