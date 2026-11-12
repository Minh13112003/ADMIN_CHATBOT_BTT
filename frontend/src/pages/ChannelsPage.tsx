import { useState } from "react";
import { useSearchParams } from "react-router";
import useSWR from "swr";
import { ChannelConnectDialog } from "@/components/ChannelConnectDialog";
import { primaryClass } from "@/components/ui";
import type { Me } from "@/lib/types";
import { fetcher } from "@/lib/api";
import { thoiGianTruoc, thoiLuong, vnd } from "@/lib/labels";
import type { CostSource } from "@/lib/types";

type ChannelHealth = {
  channel: "WEB" | "APP" | "ZALO" | "FACEBOOK";
  conversationsToday: number;
  medianSeconds: number | null;
  lastCustomerMessageAt?: string | null;
  connected: boolean;
};
const DETAILS = {
  WEB: {
    title: "bttAI Web",
    description: "Khung chat trên website BenThanh Tourist",
  },
  APP: {
    title: "bttAI App và Mini App",
    description: "Ứng dụng di động và Zalo Mini App",
  },
  ZALO: {
    title: "Zalo OA",
    description: "Chưa kết nối. Cần OA được xác thực và gói phù hợp.",
  },
  FACEBOOK: {
    title: "Facebook Messenger",
    description: "Chưa kết nối. Cần quyền quản trị Trang.",
  },
};
export default function ChannelsPage() {
  const { data, error, mutate } = useSWR<ChannelHealth[]>(
    "/stats/channels",
    fetcher,
  );
  const [sp, setSp] = useSearchParams();
  const ketQuaZalo = sp.get("zalo");
  const { data: me } = useSWR<Me>("/auth/me", fetcher);
  const [ketNoi, setKetNoi] = useState<"ZALO" | "FACEBOOK" | null>(null);
  const { data: costs } = useSWR<CostSource[]>("/stats/cost-by-source?period=month", fetcher);
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-6 px-8 py-6 max-[1199px]:px-6 max-md:gap-5 max-md:px-4 max-md:py-5 [&_table_thead]:bg-fill [&_table_thead]:text-xs [&_table_th]:whitespace-nowrap [&_table_td]:py-[18px]">
      <header className="flex flex-wrap items-center justify-between gap-5 [&_.eyebrow]:hidden [&_h1]:hidden [&_p]:mt-0 [&_p]:max-w-[660px] [&_p]:text-sm [&_p]:leading-[1.65] [&_p]:text-muted">
        <div>
          <p className="eyebrow">NGUỒN HỘI THOẠI</p>
          <h1>Kênh kết nối</h1>
          <p>Trạng thái và hoạt động của các kênh tư vấn.</p>
        </div>
      </header>
      {ketQuaZalo && (
        <p role="status" className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${ketQuaZalo === "ok" ? "border-green-soft bg-green-soft/40 text-green-ink" : "border-alert-line bg-brand-faint text-brand-text"}`}>
          <span>{ketQuaZalo === "ok" ? "Đã lấy token Zalo và lưu mã hoá. Gửi thử một tin nhắn từ Zalo cá nhân tới OA để kiểm tra." : `Kết nối Zalo chưa thành công: ${sp.get("ly") ?? "không rõ lý do"}`}</span>
          <button type="button" onClick={() => setSp({}, { replace: true })} className="shrink-0 underline">Đóng</button>
        </p>
      )}
      {!data && !error && <p role="status">Đang tải trạng thái kênh...</p>}
      {error && (
        <p role="alert" className="text-brand-text">
          Không tải được trạng thái kênh.{" "}
          <button className="underline" onClick={() => void mutate()}>
            Thử lại
          </button>
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {data?.map((c) => (
          <section
            key={c.channel}
            className={`flex min-h-[260px] flex-col rounded-[14px] border bg-surface p-6 ${c.connected ? "border-green-soft" : "border-line"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-xl text-sm font-extrabold ${c.channel === "ZALO" ? "bg-blue-soft text-blue-ink" : c.channel === "FACEBOOK" ? "bg-purple-soft text-purple-ink" : "bg-green-soft text-green-ink"}`}>{{ WEB: "Web", APP: "App", ZALO: "Zalo", FACEBOOK: "f" }[c.channel]}</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">
                  {DETAILS[c.channel].title}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {DETAILS[c.channel].description}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${c.connected ? "bg-green-soft text-green-ink" : "bg-fill text-muted"}`}
              >
                {c.connected ? "Đã kết nối" : "Chưa kết nối"}
              </span>
            </div>
            {c.connected ? (
              <dl className="mt-[22px] grid grid-cols-2 gap-3 rounded-[10px] bg-fill p-4 text-[0.8rem] [&_dd]:mt-2 [&_dd]:text-[1.3rem] [&_dd]:font-bold">
                <div>
                  <dt className="text-muted">Hội thoại có tin khách hôm nay</dt>
                  <dd className="mt-1 text-xl font-bold">
                    {c.conversationsToday}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Phản hồi trung vị hôm nay</dt>
                  <dd className="mt-1 text-xl font-bold">
                    {thoiLuong(c.medianSeconds)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Nhận tin gần nhất</dt>
                  <dd className="mt-1 text-xl font-bold">
                    {c.lastCustomerMessageAt ? thoiGianTruoc(c.lastCustomerMessageAt) : "Chưa có"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Trạng thái nhận tin</dt>
                  <dd className="mt-1 flex items-center gap-1.5 text-xl font-bold text-green-ink">
                    <span className="size-2.5 rounded-full bg-on" />
                    Đang nhận
                  </dd>
                </div>
              </dl>
            ) : <div className="mt-[22px] flex flex-col gap-1 rounded-[10px] border border-dashed border-line bg-fill p-4 text-[0.8rem] [&_span]:text-muted"><strong>Điều kiện kết nối</strong><span>{c.channel === "ZALO" ? "Zalo OA cần được xác thực, dùng gói Tăng trưởng trở lên và cấu hình webhook." : "Cần quyền quản trị Trang Facebook và quyền truy cập tin nhắn Messenger."}</span></div>}
            {!c.connected && (c.channel === "ZALO" || c.channel === "FACEBOOK") && me?.role === "ADMIN" && (
              <button type="button" onClick={() => setKetNoi(c.channel as "ZALO" | "FACEBOOK")} className={`${primaryClass} mt-4 self-start`}>Nhập thông tin kết nối</button>
            )}
            <p className="mt-auto pt-[18px] text-xs text-muted">{c.connected ? "Số liệu được lấy từ hội thoại thực tế trong hệ thống." : "Trạng thái kết nối sẽ được cập nhật khi kênh được tích hợp."}</p>
          </section>
        ))}
      </div>
      {data && <div className="grid grid-cols-2 gap-4 max-[800px]:grid-cols-1 [&_section]:min-w-0 [&_section]:rounded-[14px] [&_section]:border [&_section]:border-line [&_section]:bg-surface [&_section]:shadow-sm [&_section]:p-5 [&_h2]:text-base [&_h2]:font-bold [&_p]:mb-4 [&_p]:mt-[5px] [&_p]:text-[0.78rem] [&_p]:leading-normal [&_p]:text-muted [&_section>div]:flex [&_section>div]:justify-between [&_section>div]:gap-4 [&_section>div]:border-t [&_section>div]:border-line-soft [&_section>div]:py-3 [&_section>div]:text-[0.8rem] [&_section>div_span]:max-w-[65%] [&_section>div_span]:text-right [&_section>div_span]:text-muted">
        <section><h2>Khung thời gian phản hồi</h2><p>Quy định của kênh sẽ áp dụng sau khi kết nối tài khoản tương ứng.</p><div><strong>Zalo OA</strong><span>Tư vấn miễn phí trong 48 giờ kể từ lần khách tương tác.</span></div><div><strong>Facebook Messenger</strong><span>Trả lời trong cửa sổ 24 giờ theo chính sách của Meta.</span></div></section>
        <section><h2>Chi phí theo nguồn trong tháng</h2><p>Số liệu ước tính từ các kênh đã được hệ thống ghi nhận.</p>{costs ? costs.map((item) => <div key={item.source}><strong>{item.source === 'AI' ? 'AI bttAI' : item.source === 'ZALO' ? 'Zalo OA' : 'Facebook'}</strong><span>{item.connected ? vnd(item.costVnd) : 'Chưa kết nối'}</span></div>) : <p>Đang tải chi phí...</p>}</section>
      </div>}
      {ketNoi && <ChannelConnectDialog channel={ketNoi} title={DETAILS[ketNoi].title} onClose={() => setKetNoi(null)} onSaved={() => void mutate()} />}
    </main>
  );
}
