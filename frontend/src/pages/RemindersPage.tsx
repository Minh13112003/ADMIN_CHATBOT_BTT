import { useMemo, useState } from "react";
import { Link } from "react-router";
import useSWR from "swr";
import { Dialog, ErrorText } from "@/components/ui";
import { fetcher, loiCua, patch } from "@/lib/api";
import { CHANNEL, gioTin } from "@/lib/labels";
import type { ConversationList } from "@/lib/types";

const dayKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};
const nextMorning = () => {
  const [year, month, day] = dayKey(new Date()).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1, 2));
};

export default function RemindersPage() {
  const { data, error, isLoading, mutate } = useSWR<ConversationList>(
    "/conversations?followUp=1&take=500",
    fetcher,
    { refreshInterval: 60000 },
  );
  const { data: conversations } = useSWR<ConversationList>("/conversations?take=500", fetcher);
  const [newOpen, setNewOpen] = useState(false);
  const [newConversation, setNewConversation] = useState("");
  const [newAt, setNewAt] = useState("");
  const [newNote, setNewNote] = useState("");
  const [day, setDay] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState<string | null>(null);
  const today = dayKey(new Date());
  const tomorrow = dayKey(new Date(Date.now() + 86400_000));
  const week = useMemo(() => {
    const [y, m, d] = dayKey(new Date()).split("-").map(Number);
    const vnToday = new Date(Date.UTC(y, m - 1, d));
    const monday = new Date(
      vnToday.getTime() - ((vnToday.getUTCDay() + 6) % 7) * 86400_000,
    );
    return Array.from(
      { length: 7 },
      (_, i) => new Date(monday.getTime() + i * 86400_000),
    );
  }, []);
  const items = (data?.items ?? []).filter(
    (c) => !!c.followUp && (!day || dayKey(new Date(c.followUp.at)) === day),
  );
  const allItems = (data?.items ?? []).filter((c) => !!c.followUp);
  const overdueCount = allItems.filter((c) => new Date(c.followUp!.at).getTime() < Date.now()).length;
  const todayCount = allItems.filter((c) => dayKey(new Date(c.followUp!.at)) === today).length;
  const groups = [
    {
      title: "Quá hạn",
      rows: items.filter(
        (c) => c.followUp && new Date(c.followUp.at).getTime() < Date.now(),
      ),
    },
    {
      title: "Hôm nay",
      rows: items.filter(
        (c) =>
          c.followUp &&
          new Date(c.followUp.at).getTime() >= Date.now() &&
          dayKey(new Date(c.followUp.at)) === today,
      ),
    },
    {
      title: "Ngày mai",
      rows: items.filter(
        (c) => c.followUp && dayKey(new Date(c.followUp.at)) === tomorrow,
      ),
    },
    {
      title: "Tuần này và sau đó",
      rows: items.filter(
        (c) => c.followUp && dayKey(new Date(c.followUp.at)) > tomorrow,
      ),
    },
  ];
  const update = async (id: string, at: Date | null) => {
    setBusy(id);
    setActionError("");
    try {
      await patch(`/conversations/${id}`, {
        followUpAt: at?.toISOString() ?? null,
      });
      await mutate();
    } catch (err) {
      setActionError(loiCua(err));
    } finally {
      setBusy(null);
    }
  };
  const createReminder = async () => {
    if (!newConversation || !newAt) return;
    const at = new Date(newAt);
    if (Number.isNaN(at.getTime())) { setActionError("Giờ hẹn không hợp lệ."); return; }
    setBusy("new"); setActionError("");
    try {
      await patch(`/conversations/${newConversation}`, { followUpAt: at.toISOString(), followUpNote: newNote.trim() });
      await mutate();
      setNewOpen(false); setNewConversation(""); setNewAt(""); setNewNote("");
    } catch (err) { setActionError(loiCua(err)); }
    finally { setBusy(null); }
  };
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-6 px-8 py-6 max-[1199px]:px-6 max-md:gap-5 max-md:px-4 max-md:py-5 [&_table_thead]:bg-fill [&_table_thead]:text-xs [&_table_th]:whitespace-nowrap [&_table_td]:py-[18px] reminders-page">
      <header className="flex flex-wrap items-center justify-between gap-5 [&_.eyebrow]:hidden [&_h1]:hidden [&_p]:mt-0 [&_p]:max-w-[660px] [&_p]:text-sm [&_p]:leading-[1.65] [&_p]:text-muted">
        <div>
          <p className="eyebrow">CHĂM SÓC ĐÚNG HẸN</p>
          <h1>Lịch hẹn nhắc</h1>
          <p>Những việc cần tiếp tục với khách hàng.</p>
        </div>
        <button type="button" className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-brand-button bg-brand-button text-white" onClick={() => setNewOpen(true)}>+ Thêm lịch hẹn</button>
      </header>
      <div className="grid grid-cols-3 gap-3 max-[700px]:grid-cols-1 [&>div]:flex [&>div]:items-center [&>div]:justify-between [&>div]:gap-3 [&>div]:rounded-[11px] [&>div]:border [&>div]:border-line [&>div]:bg-surface [&>div]:shadow-sm [&>div]:px-[18px] [&>div]:py-[15px] [&_span]:text-[0.82rem] [&_span]:text-muted [&_strong]:text-[1.35rem] [&_strong]:text-brand-text"><div><span>Quá hạn cần xử lý</span><strong>{overdueCount}</strong></div><div><span>Lịch hẹn hôm nay</span><strong>{todayCount}</strong></div><div><span>Tổng lịch đang theo dõi</span><strong>{allItems.length}</strong></div></div>
      <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-5 max-[1100px]:grid-cols-1">
        <div className="min-w-0">
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
            <button
              className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface"
              aria-pressed={!day}
              onClick={() => setDay(null)}
            >
              Tất cả
            </button>
            {week.map((d) => (
              <button
                className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface whitespace-nowrap"
                key={dayKey(d)}
                aria-pressed={day === dayKey(d)}
                onClick={() => setDay(dayKey(d))}
              >
                {new Intl.DateTimeFormat("vi-VN", {
                  weekday: "short",
                  day: "numeric",
                  timeZone: "Asia/Ho_Chi_Minh",
                }).format(d)}
              </button>
            ))}
          </div>
          {isLoading && !data && <p role="status">Đang tải lịch hẹn...</p>}
          {error && (
            <div role="alert">
              <ErrorText>Không tải được lịch hẹn.</ErrorText>
              <button className="underline" onClick={() => void mutate()}>
                Thử lại
              </button>
            </div>
          )}
          <ErrorText>{actionError}</ErrorText>
          {data && items.length === 0 && (
            <p className="rounded-xl border border-line bg-surface shadow-sm p-8 text-center text-muted">
              {day ? "Không có hẹn nhắc trong ngày đã chọn." : "Chưa có hẹn nhắc. Bạn có thể đặt lịch từ hồ sơ khách trong Hội thoại."}
            </p>
          )}
          {groups
            .filter((g) => g.rows.length)
            .map((g) => (
              <section key={g.title} className="mb-6">
                <h2 className={`mb-3 flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-bold uppercase tracking-wide ${g.title === "Quá hạn" ? "border-alert-line bg-brand-faint text-brand-text" : "border-line bg-fill text-body"}`}>
                  <span>{g.title === "Quá hạn" ? "Hẹn quá hạn cần xử lý gấp" : `Lịch hẹn ${g.title.toLowerCase()}`}</span>
                  <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs">{g.rows.length} việc</span>
                </h2>
                <div className="space-y-3">
                  {g.rows.map((c) => (
                    <article key={c.id} className="min-w-0 rounded-xl border border-line bg-surface shadow-sm p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <strong>{c.customer.name}</strong>
                          <p className="text-sm text-muted">
                            {CHANNEL[c.channel].label} · Phụ trách:{" "}
                            {c.assignee?.fullName ?? "Chưa có"}
                          </p>
                        </div>
                        <time className="text-sm font-semibold text-brand-text">
                          {gioTin(c.followUp!.at)}
                        </time>
                      </div>
                      {c.followUp?.note && (
                        <p className="my-3 rounded-lg bg-fill p-3 text-sm">
                          {c.followUp.note}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          to={`/inbox?c=${c.id}`}
                          className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-brand-button bg-brand-button text-white"
                        >
                          Mở hội thoại
                        </Link>
                        <button
                          disabled={busy === c.id}
                          className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface"
                          onClick={() => void update(c.id, null)}
                        >
                          Xong
                        </button>
                        <button className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface" onClick={() => setReschedule(c.id)}>Dời hẹn</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
        </div>
        <aside className="min-w-0 self-start rounded-xl border border-line bg-surface shadow-sm p-4 max-[1100px]:hidden">
          <h2 className="mb-4 font-semibold">Lịch trong tuần</h2>
          {week.map((d) => (
            <button
              key={dayKey(d)}
              className="flex w-full justify-between rounded-lg p-3 text-left hover:bg-fill"
              aria-pressed={day === dayKey(d)}
              onClick={() => setDay(day === dayKey(d) ? null : dayKey(d))}
            >
              <span>
                {new Intl.DateTimeFormat("vi-VN", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                  timeZone: "Asia/Ho_Chi_Minh",
                }).format(d)}
              </span>
              <strong>
                {data?.items.filter(
                  (c) =>
                    c.followUp && dayKey(new Date(c.followUp.at)) === dayKey(d),
                ).length ?? 0}
              </strong>
            </button>
          ))}
          {day && (
            <button
              className="mt-3 text-sm text-brand-text underline"
              onClick={() => setDay(null)}
            >
              Xem tất cả
            </button>
          )}
          <div className="mt-4 border-t border-line pt-4 [&_h3]:mb-3 [&_h3]:text-[0.85rem] [&_h3]:font-bold [&>a]:flex [&>a]:gap-2.5 [&>a]:border-t [&>a]:border-line-soft [&>a]:py-[11px] [&>a]:text-[0.8rem] [&_time]:shrink-0 [&_time]:font-bold [&_time]:text-brand-text [&_small]:block [&_small]:leading-normal [&_small]:text-muted [&>p]:text-[0.8rem] [&>p]:text-muted"><h3>Lịch theo giờ hôm nay</h3>{allItems.filter((c) => dayKey(new Date(c.followUp!.at)) === today).sort((a,b) => new Date(a.followUp!.at).getTime() - new Date(b.followUp!.at).getTime()).map((c) => <Link key={c.id} to={`/inbox?c=${c.id}`}><time>{gioTin(c.followUp!.at)}</time><span>{c.customer.name}<small>{c.followUp?.note || "Mở hội thoại để xem chi tiết"}</small></span></Link>)}{todayCount === 0 && <p>Chưa có lịch hẹn hôm nay.</p>}</div>
        </aside>
      </div>
      {reschedule && <Dialog title="Dời hẹn nhắc" variant="drawer" onClose={() => setReschedule(null)}><div className="flex flex-col gap-2">{[{ label: '+30 phút', at: new Date(Date.now() + 30 * 60000) }, { label: '+2 giờ', at: new Date(Date.now() + 2 * 3600_000) }, { label: 'Sáng mai 09:00', at: nextMorning() }].map((option) => <button key={option.label} className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface" onClick={() => { void update(reschedule, option.at); setReschedule(null); }}>{option.label}</button>)}</div></Dialog>}
      {newOpen && <Dialog title="Thêm lịch hẹn nhắc" variant="drawer" onClose={() => setNewOpen(false)}><div className="flex flex-col gap-4"><label className="text-sm font-medium">Khách hàng<select className="mt-2 w-full rounded-lg border border-field bg-surface p-3" value={newConversation} onChange={(e) => setNewConversation(e.target.value)}><option value="">Chọn khách hàng</option>{conversations?.items.map((c) => <option key={c.id} value={c.id}>{c.customer.name} · {c.customer.phone ?? CHANNEL[c.channel].label}</option>)}</select></label><label className="text-sm font-medium">Thời gian<input type="datetime-local" className="mt-2 w-full rounded-lg border border-field bg-surface p-3" value={newAt} onChange={(e) => setNewAt(e.target.value)} /></label><label className="text-sm font-medium">Nội dung cần nhắc<textarea maxLength={300} rows={4} className="mt-2 w-full rounded-lg border border-field bg-surface p-3" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Ví dụ: Gọi tư vấn lịch khởi hành" /></label><ErrorText>{actionError}</ErrorText><button type="button" disabled={!newConversation || !newAt || busy === "new"} className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-brand-button bg-brand-button text-white" onClick={() => void createReminder()}>Lưu lịch hẹn</button></div></Dialog>}
    </main>
  );
}
