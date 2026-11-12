import { useState } from "react";
import { Link } from "react-router";
import useSWR from "swr";
import { CloseDealDialog } from "@/components/inbox/CloseDealDialog";
import { ErrorText, Segmented } from "@/components/ui";
import { fetcher, loiCua, post } from "@/lib/api";
import { Icon } from "@/components/icons";
import { CHANNEL, vnd } from "@/lib/labels";
import type { Conversation, Deal } from "@/lib/types";

type DealRow = Deal & {
  customer: { name: string; phone: string | null };
  conversation: { assignee: { fullName: string } | null };
};
type Period = "today" | "week" | "month" | "all";

export default function DealsPage() {
  const [period, setPeriod] = useState<Period>("month");
  const { data, error, isLoading, mutate } = useSWR<DealRow[]>(
    `/deals?period=${period}`,
    fetcher,
  );
  const [selected, setSelected] = useState<DealRow | null>(null);
  const { data: conv } = useSWR<Conversation>(
    selected ? `/conversations/${selected.conversationId}` : null,
    fetcher,
  );
  const [cancel, setCancel] = useState<DealRow | null>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<"ALL" | "WEB" | "APP">("ALL");
  const visible = data?.filter((d) => (channel === "ALL" || d.channel === channel) && `${d.customer.name} ${d.customer.phone ?? ""} ${d.tourName} ${d.tourCode ?? ""}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"))) ?? [];
  const groups = [
    {
      title: "Chờ xác nhận",
      rows: visible.filter((d) => d.status === "PENDING" && !d.voidedAt),
      tone: "pending",
    },
    {
      title: "Đã chốt",
      rows: visible.filter((d) => d.status === "CONFIRMED" && !d.voidedAt),
      tone: "confirmed",
    },
    {
      title: "Đã huỷ",
      rows: visible.filter((d) => d.status === "CANCELLED" || !!d.voidedAt),
      tone: "cancelled",
    },
  ];
  const cancelDeal = async () => {
    if (!cancel || saving) return;
    setSaving(true);
    setActionError("");
    try {
      await post(
        `/conversations/${cancel.conversationId}/deals/${cancel.id}/cancel`,
        reason.trim() ? { reason: reason.trim() } : {},
      );
      await mutate();
      setCancel(null);
      setReason("");
    } catch (err) {
      setActionError(loiCua(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-6 px-8 py-6 max-[1199px]:px-6 max-md:gap-5 max-md:px-4 max-md:py-5 [&_table_thead]:bg-fill [&_table_thead]:text-xs [&_table_th]:whitespace-nowrap [&_table_td]:py-[18px] deals-page">
      <header className="flex flex-wrap items-center justify-between gap-5 [&_.eyebrow]:hidden [&_h1]:hidden [&_p]:mt-0 [&_p]:max-w-[660px] [&_p]:text-sm [&_p]:leading-[1.65] [&_p]:text-muted">
        <div>
          <p className="eyebrow">HÀNH TRÌNH ĐẶT TOUR</p>
          <h1>Đơn đặt tour</h1>
          <p>Theo dõi đơn chờ xác nhận và doanh thu đã chốt.</p>
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
      <div className="grid grid-cols-[minmax(220px,1fr)_minmax(150px,180px)_auto_auto] items-stretch gap-3 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
        <label className="flex min-h-16 items-center rounded-xl border border-line bg-surface shadow-sm px-4 py-3 max-[1100px]:col-span-full max-[700px]:col-auto [&_input]:w-full [&_input]:min-w-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-sm [&_input]:outline-0 [&_input]:shadow-none focus-within:outline-2 focus-within:outline-brand"><span className="sr-only">Tìm đơn đặt tour</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên khách, số điện thoại, mã tour..." /></label>
        <label className="flex min-w-0 rounded-xl border border-line bg-surface shadow-sm p-3 [&_select]:w-full [&_select]:min-w-0 [&_select]:border-0 [&_select]:bg-transparent [&_select]:text-[0.82rem] [&_select]:outline-0"><span className="sr-only">Lọc theo nguồn</span><select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}><option value="ALL">Tất cả nguồn</option><option value="WEB">bttAI Web</option><option value="APP">bttAI App</option></select></label>
        <div className="flex min-h-16 min-w-[180px] flex-col items-start justify-center gap-[3px] rounded-xl border border-line bg-green-soft/40 border-green-soft shadow-sm px-4 py-3 [&_span]:text-xs [&_span]:text-muted [&_strong]:text-[1.05rem] [&_strong]:text-green-ink [&.pending_strong]:text-brand-text"><span>Doanh thu đã chốt</span><strong>{vnd((data ?? []).filter((d) => d.status === "CONFIRMED" && !d.voidedAt).reduce((sum, d) => sum + d.amount, 0))}</strong></div>
        <div className="flex min-h-16 min-w-[180px] flex-col items-start justify-center gap-[3px] rounded-xl border border-line bg-auto-soft border-amber-line shadow-sm px-4 py-3 [&_span]:text-xs [&_span]:text-muted [&_strong]:text-[1.05rem] [&_strong]:text-green-ink [&.pending_strong]:text-brand-text pending"><span>Chờ xác nhận</span><strong>{(data ?? []).filter((d) => d.status === "PENDING" && !d.voidedAt).length} đơn</strong></div>
      </div>
      {isLoading && !data && <p role="status">Đang tải đơn đặt tour...</p>}
      {error && (
        <div role="alert">
          <ErrorText>Không tải được đơn đặt tour.</ErrorText>
          <button
            className="text-brand-text underline"
            onClick={() => void mutate()}
          >
            Thử lại
          </button>
        </div>
      )}
      {data && (
        <div className="grid grid-cols-3 gap-4 max-[1100px]:grid-cols-1">
          {groups.map((g) => (
            <section key={g.title} className={`min-w-0 overflow-hidden rounded-[14px] border [&>h2]:flex [&>h2]:justify-between [&>h2]:border-b [&>h2]:border-line [&>h2]:p-4 [&>h2]:font-bold [&>h2_span]:rounded-full [&>h2_span]:bg-surface [&>h2_span]:px-2 ${{"pending":"border-amber-line bg-auto-soft [&>h2]:text-amber-ink","confirmed":"border-green-soft bg-[color-mix(in_srgb,var(--color-green-soft)_35%,var(--color-surface))] [&>h2]:text-green-ink","cancelled":"border-line bg-fill"}[g.tone]}`}>
              <h2>
                <span className="flex items-center gap-2"><i className={`size-2.5 rounded-full not-italic ${g.tone === "pending" ? "bg-amber-ink" : g.tone === "confirmed" ? "bg-on" : "bg-off"}`} />{g.title}</span> <span>{g.rows.length} đơn · {vnd(g.rows.reduce((t, r) => t + r.amount, 0))}</span>
              </h2>
              <div className="flex flex-col gap-3 p-3">
                {g.rows.length === 0 && (
                  <p className="grid min-h-[150px] place-items-center rounded-[10px] border border-dashed border-line bg-surface p-4 text-center text-sm text-muted">{query ? "Không có đơn khớp tìm kiếm." : "Chưa có đơn trong kỳ này."}</p>
                )}
                {g.rows.map((d) => (
                  <article key={d.id} className={`min-w-0 rounded-xl border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md ${g.tone === "pending" ? "border-amber-line" : g.tone === "confirmed" ? "border-green-soft" : "border-line"} [&_strong]:[overflow-wrap:anywhere] [&_p]:[overflow-wrap:anywhere]`}>
                    <div className="flex items-center justify-between gap-2">
                      <strong className="min-w-0 flex-1">{d.customer.name}</strong>
                      <span className="shrink-0 rounded bg-blue-soft px-2 py-0.5 text-[0.6875rem] font-bold text-blue-ink">
                        {CHANNEL[d.channel].label}
                      </span>
                    </div>
                    {d.customer.phone && <p className="text-xs text-muted">{d.customer.phone}</p>}
                    <div className="mt-3 rounded-lg border border-line-soft bg-page p-2.5">
                      <p className="text-sm font-semibold leading-snug">{d.tourName}</p>
                      <p className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
                        <span className="font-mono">{d.tourCode ?? "Chưa có mã tour"}</span>
                        <span>{d.guests} khách</span>
                      </p>
                    </div>
                    <p className="mt-3 text-[0.6875rem] font-bold uppercase tracking-wide text-muted">
                      {g.tone === "pending" ? "Tổng giá trị đơn" : g.tone === "confirmed" ? "Doanh thu ghi nhận" : "Giá trị huỷ"}
                    </p>
                    <p className="text-lg font-bold text-brand-text">
                      {vnd(d.amount)}
                    </p>
                    <p className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                      <span className={`rounded px-2 py-0.5 font-semibold ${d.source === "CHATBOT" ? "bg-purple-soft text-purple-ink" : "bg-amber-soft text-amber-ink"}`}>
                        {d.source === "CHATBOT" ? "Chatbot" : "Sale"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="grid size-6 place-items-center rounded-full bg-brand-soft text-[0.625rem] font-bold text-brand-text">
                          {(d.conversation.assignee?.fullName ?? "?").split(" ").slice(-2).map((w) => w[0]).join("").toUpperCase()}
                        </span>
                        {d.conversation.assignee?.fullName ?? "Chưa có"}
                      </span>
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line-soft pt-3">
                      {d.customer.phone && (
                        <a className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-field bg-surface px-3 text-[0.8125rem] font-semibold shadow-sm hover:bg-fill" href={`tel:${d.customer.phone}`}>
                          <Icon name="phone" size={15} /> Gọi khách
                        </a>
                      )}
                      {g.tone === "pending" && (
                        <button className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-button bg-brand-button px-3 text-[0.8125rem] font-semibold text-white shadow-sm hover:bg-brand-dark" onClick={() => setSelected(d)}>
                          <Icon name="checkCircle" size={15} /> Xác nhận đơn
                        </button>
                      )}
                      <Link className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-field bg-surface px-3 text-[0.8125rem] font-semibold hover:bg-fill" to={`/inbox?c=${d.conversationId}`}>
                        <Icon name="chat" size={15} /> Mở hội thoại
                      </Link>
                      {g.tone === "pending" && (
                        <button className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-field bg-surface px-3 text-[0.8125rem] font-semibold text-muted hover:bg-fill" onClick={() => setCancel(d)}>
                          <Icon name="x" size={15} /> Khách huỷ
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {selected && conv && (
        <CloseDealDialog
          conv={conv}
          deal={selected}
          pending={[selected]}
          onClose={() => setSelected(null)}
          onDone={() => {
            void mutate();
          }}
        />
      )}
      {selected && !conv && (
        <p role="status">Đang tải thông tin hội thoại...</p>
      )}
      {cancel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Khách huỷ đơn"
            className="w-full max-w-md rounded-2xl bg-surface p-6"
          >
            <h2 className="text-lg font-semibold">Khách huỷ đơn</h2>
            <p className="my-3 text-sm text-body">
              Đơn {cancel.tourName} sẽ không tính doanh thu.
            </p>
            <label className="block text-sm">
              Lý do (không bắt buộc)
              <input
                className="mt-2 w-full rounded-lg border border-field p-3"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <ErrorText>{actionError}</ErrorText>
            <div className="mt-4 flex justify-end gap-3">
              <button className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface" onClick={() => setCancel(null)}>
                Không huỷ
              </button>
              <button
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-brand-button bg-brand-button text-white"
                onClick={() => void cancelDeal()}
              >
                Huỷ đơn
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
