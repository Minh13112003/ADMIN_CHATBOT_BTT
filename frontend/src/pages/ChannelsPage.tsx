import useSWR from "swr";
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
  const health = useSWR<{ ok: boolean }>("/health", fetcher, {
    refreshInterval: 30000,
  });
  const { data: costs } = useSWR<CostSource[]>("/stats/cost-by-source?period=month", fetcher);
  return (
    <main className="page-layout">
      <header className="page-heading">
        <div>
          <p className="eyebrow">NGUỒN HỘI THOẠI</p>
          <h1>Kênh kết nối</h1>
          <p>Trạng thái và hoạt động của các kênh tư vấn.</p>
        </div>
      </header>
      <p
        role="status"
        className={`self-start rounded-full px-3 py-1 text-sm font-medium ${health.data?.ok ? "bg-green-soft text-green-ink" : "bg-fill text-muted"}`}
      >
        Backend:{" "}
        {health.data?.ok
          ? "Hoạt động"
          : health.error
            ? "Mất kết nối"
            : "Đang kiểm tra"}
      </p>
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
            className={`channel-card ${c.connected ? "is-connected" : ""}`}
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
              <dl className="channel-metrics">
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
            ) : <div className="channel-unavailable"><strong>Điều kiện kết nối</strong><span>{c.channel === "ZALO" ? "Zalo OA cần được xác thực, dùng gói Tăng trưởng trở lên và cấu hình webhook." : "Cần quyền quản trị Trang Facebook và quyền truy cập tin nhắn Messenger."}</span></div>}
            <p className="channel-footnote">{c.connected ? "Số liệu được lấy từ hội thoại thực tế trong hệ thống." : "Trạng thái kết nối sẽ được cập nhật khi kênh được tích hợp."}</p>
          </section>
        ))}
      </div>
      {data && <div className="channel-extra-grid">
        <section><h2>Khung thời gian phản hồi</h2><p>Quy định của kênh sẽ áp dụng sau khi kết nối tài khoản tương ứng.</p><div><strong>Zalo OA</strong><span>Tư vấn miễn phí trong 48 giờ kể từ lần khách tương tác.</span></div><div><strong>Facebook Messenger</strong><span>Trả lời trong cửa sổ 24 giờ theo chính sách của Meta.</span></div></section>
        <section><h2>Chi phí theo nguồn trong tháng</h2><p>Số liệu ước tính từ các kênh đã được hệ thống ghi nhận.</p>{costs ? costs.map((item) => <div key={item.source}><strong>{item.source === 'AI' ? 'AI bttAI' : item.source === 'ZALO' ? 'Zalo OA' : 'Facebook'}</strong><span>{item.connected ? vnd(item.costVnd) : 'Chưa kết nối'}</span></div>) : <p>Đang tải chi phí...</p>}</section>
      </div>}
    </main>
  );
}
