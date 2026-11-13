import { useState } from "react";
import { useSearchParams } from "react-router";
import useSWR from "swr";
import { ChannelConnectDialog } from "@/components/ChannelConnectDialog";
import { primaryClass, secondaryClass } from "@/components/ui";
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
type TrangThaiZalo = { coToken: boolean; accessTokenHetLuc: string | null; refreshTokenHetLuc: string | null; loiToken: { luc: string; lyDo: string } | null; guiLoiHomNay: number };

/** Chi tiết kết nối Zalo cho admin (Stitch: "Kênh kết nối - Quản trị kênh hội thoại đa nguồn"). */
function ChiTietZalo({ z }: { z: TrangThaiZalo }) {
  const conNgay = z.refreshTokenHetLuc ? Math.max(0, Math.round((new Date(z.refreshTokenHetLuc).getTime() - Date.now()) / 86_400_000)) : null;
  const dong = "flex items-center justify-between gap-3 rounded-[10px] border border-line px-3.5 py-2.5 text-[0.8125rem]";
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className={dong}>
        <span className="flex items-center gap-2"><span className={`size-2.5 rounded-full ${z.loiToken || !z.coToken ? "bg-brand" : "bg-on"}`} />Token Zalo</span>
        <strong className={z.loiToken || !z.coToken ? "text-alert-ink" : "text-green-ink"}>{!z.coToken ? "Chưa có, bấm kết nối" : z.loiToken ? "Lỗi, cần kết nối lại" : "Tự làm mới, còn hạn"}</strong>
      </div>
      {conNgay !== null && (
        <div className={`${dong} flex-col items-stretch`}>
          <span className="flex justify-between"><span>Refresh token hết hạn sau</span><strong>{conNgay} ngày</strong></span>
          <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-fill"><span className={`block h-full rounded-full ${conNgay < 10 ? "bg-brand" : "bg-on"}`} style={{ width: `${Math.min(100, (conNgay / 90) * 100)}%` }} /></span>
          <span className="text-xs text-muted">Tự gia hạn mỗi lần làm mới token. Gần hết hạn nghĩa là đã lâu không làm mới được.</span>
        </div>
      )}
      <div className={dong}>
        <span>Tin gửi sang Zalo bị lỗi hôm nay</span>
        <strong className={z.guiLoiHomNay ? "text-alert-ink" : ""}>{z.guiLoiHomNay} tin</strong>
      </div>
    </div>
  );
}

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
  const laAdmin = me?.role === "ADMIN";
  const { data: zalo } = useSWR<TrangThaiZalo>(laAdmin ? "/channel-settings/zalo/status" : null, fetcher, { refreshInterval: 60_000 });
  const zaloCoCauHinh = !!data?.find((c) => c.channel === "ZALO")?.connected || !!zalo?.coToken;
  const zaloLoi = !!zalo && zaloCoCauHinh && (!!zalo.loiToken || !zalo.coToken);
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
      {zaloLoi && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-alert-line bg-brand-faint px-4 py-3 text-sm text-alert-ink">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
          <span className="min-w-0 flex-1"><strong>Zalo OA có thể đã mất kết nối</strong>{zalo?.loiToken ? ` từ ${new Date(zalo.loiToken.luc).toLocaleString("vi-VN")}: ${zalo.loiToken.lyDo}` : ": chưa có token"}. Tin mới của khách có thể không về cho tới khi kết nối lại.</span>
          <button type="button" onClick={() => setKetNoi("ZALO")} className={primaryClass}>Kết nối lại</button>
        </div>
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
                  {c.connected && (c.channel === "ZALO" || c.channel === "FACEBOOK") ? "Đang nhận tin từ khách." : DETAILS[c.channel].description}
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
            {c.channel === "ZALO" && zalo && (zalo.coToken || c.connected) && <ChiTietZalo z={zalo} />}
            {(c.channel === "ZALO" || c.channel === "FACEBOOK") && me?.role === "ADMIN" && (
              <button type="button" onClick={() => setKetNoi(c.channel as "ZALO" | "FACEBOOK")} className={`${c.connected ? secondaryClass : primaryClass} mt-4 self-start`}>{c.connected ? "Quản lý thông tin kết nối" : "Nhập thông tin kết nối"}</button>
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
