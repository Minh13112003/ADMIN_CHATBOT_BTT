import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { AnhKhach } from '../ui';
import { fetcher } from '@/lib/api';
import { CHANNEL, CHANNEL_LIST, dinhDangSo, gioTin, STATUS, STATUS_LIST, TAGS, thoiGianTruoc } from '@/lib/labels';
import type { Channel, ConversationList as ListData, MessageHit, Status } from '@/lib/types';

export function ConversationList({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [take, setTake] = useState(100);
  const [tag, setTag] = useState('');
  const [coHen, setCoHen] = useState(false);
  /** Tìm trong nội dung tin nhắn thay vì tên / SĐT khách. */
  const [timTin, setTimTin] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const qs = new URLSearchParams({ take: String(take) });
  if (status) qs.set('status', status);
  if (channel) qs.set('channel', channel);
  if (debounced.trim()) qs.set('search', debounced.trim());
  if (tag) qs.set('tag', tag);
  if (coHen) qs.set('followUp', '1');

  const { data, error, isLoading } = useSWR<ListData>(timTin ? null : `/conversations?${qs}`, fetcher, { refreshInterval: 60_000, keepPreviousData: true });
  const tuTin = debounced.trim();
  const kq = useSWR<MessageHit[]>(timTin && tuTin.length >= 2 ? `/messages/search?q=${encodeURIComponent(tuTin)}` : null, fetcher, { keepPreviousData: true });
  const tong = data ? Object.values(data.counts).reduce((a, b) => a + (b ?? 0), 0) : 0;

  return (
    <section aria-label="Danh sách hội thoại" className="flex h-full min-h-0 w-full flex-col border-r border-line bg-surface">
      <div className="border-b border-line flex flex-col gap-3 px-4 pb-4 pt-5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold">
            Hộp thư <span className="ml-1 text-sm font-medium text-muted">{tong}</span>
          </h1>
          <button
            type="button"
            className="flex min-h-11 items-center gap-[5px] rounded-[9px] border border-line px-2 text-xs text-body"
            aria-expanded={filtersOpen}
            aria-controls="inbox-advanced-filters"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h16M7 12h10M10 17h4" />
            </svg>
            Bộ lọc{(tag || coHen || timTin || status) && <span className="size-2 rounded-full bg-brand" />}
          </button>
        </div>
        <label className="flex min-h-11 items-center gap-2 rounded-[10px] bg-fill px-3">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6472" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            aria-label={timTin ? 'Tìm trong nội dung tin nhắn' : 'Tìm theo tên hoặc số điện thoại'}
            placeholder={timTin ? 'Tìm trong nội dung tin nhắn' : 'Tìm tên hoặc số điện thoại'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-offset-4"
          />
        </label>

        <div id="inbox-advanced-filters" hidden={!filtersOpen} className={filtersOpen ? 'flex flex-wrap items-center gap-2 text-[0.8125rem]' : 'hidden'}>
          {!timTin && (
            <div role="group" aria-label="Lọc theo trạng thái" className="flex w-full flex-wrap gap-1.5">
              <button type="button" aria-pressed={!status} onClick={() => setStatus(null)} className={`min-h-9 whitespace-nowrap rounded-lg px-3 text-xs font-semibold ${!status ? 'bg-brand-soft text-brand-text' : 'bg-fill text-body'}`}>Tất cả ({tong})</button>
              {STATUS_LIST.map((s) => <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={`min-h-9 whitespace-nowrap rounded-lg px-3 text-xs font-semibold ${status === s ? 'bg-brand-soft text-brand-text' : 'bg-fill text-body'}`}>{STATUS[s].label} ({data?.counts[s] ?? 0})</button>)}
            </div>
          )}
          <button
            type="button"
            aria-pressed={timTin}
            onClick={() => setTimTin(!timTin)}
            className={`min-h-9 rounded-full border px-2.5 ${timTin ? 'border-ink bg-strong text-on-strong' : 'border-field bg-surface text-neutral-ink'}`}
          >
            Tìm trong tin
          </button>
          {!timTin && (
            <>
              <select
                aria-label="Lọc theo nhãn"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="min-h-9 min-w-0 flex-1 rounded-full border border-field bg-surface px-2.5 text-[0.8125rem]"
              >
                <option value="">Mọi nhãn</option>
                {TAGS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-pressed={coHen}
                onClick={() => setCoHen(!coHen)}
                className={`min-h-9 shrink-0 rounded-full border px-2.5 ${coHen ? 'border-ink bg-strong text-on-strong' : 'border-field bg-surface text-neutral-ink'}`}
              >
                Có hẹn
              </button>
            </>
          )}
        </div>

        {!timTin && (
          <>
            <div role="group" aria-label="Lọc theo nguồn" className="flex flex-wrap gap-1 rounded-[10px] bg-fill p-[3px]">
              <NutNguon active={!channel} onClick={() => setChannel(null)} label="Tất cả" />
              {CHANNEL_LIST.map((k) => (
                <NutNguon
                  key={k}
                  active={channel === k}
                  onClick={() => setChannel(k)}
                  label={CHANNEL[k].short}
                  disabled={!CHANNEL[k].connected}
                  title={CHANNEL[k].connected ? undefined : 'Chưa kết nối'}
                />
              ))}
            </div>

          </>
        )}
      </div>

      {timTin ? (
        <KetQuaTimTin q={tuTin} data={kq.data} error={kq.error} isLoading={kq.isLoading} onSelect={onSelect} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {data?.items.map((c) => {
            const lh = c.status === 'CONTACT';
            const dangChon = c.id === selected;
            const chuaXem = c.status === 'UNREAD';
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                aria-current={dangChon}
                className={`relative aria-[current=true]:shadow-[inset_3px_0_var(--color-brand)] [:root[data-density=compact]_&]:py-[0.4rem] flex w-full gap-3 border-b border-line-soft px-4 py-4 text-left hover:bg-page ${dangChon ? 'bg-brand-soft' : lh ? 'bg-brand-faint shadow-[inset_4px_0_var(--color-brand)]' : chuaXem ? 'bg-blue-soft/50 shadow-[inset_4px_0_var(--color-blue-ink)]' : 'bg-surface'}`}
              >
                <AnhKhach ten={c.customer.name} anh={c.customer.avatarUrl} className={`flex size-11 shrink-0 items-center justify-center rounded-full font-semibold ${lh ? 'ping bg-status-contact text-white' : 'bg-neutral-soft text-neutral-ink'}`} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline gap-2">
                    <span className={`min-w-0 flex-1 truncate text-[0.9375rem] ${lh ? 'font-extrabold text-brand-text' : chuaXem ? 'font-extrabold text-ink' : 'font-medium'}`}>
                      {c.customer.name}
                    </span>
                    {lh && (
                      <span role="img" aria-label="Khách cần nhân viên gấp" title="Khách cần nhân viên gấp" className="shrink-0 text-brand">
                        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="animate-pulse">
                          <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" />
                          <path d="M10 20a2 2 0 0 0 4 0" fill="none" strokeLinecap="round" />
                        </svg>
                      </span>
                    )}
                    {chuaXem && <span aria-label="Chưa đọc" className="size-2.5 shrink-0 rounded-full bg-blue-ink" />}
                    <span className={`shrink-0 text-xs ${lh || chuaXem ? 'font-semibold text-ink' : 'text-muted'}`}>{thoiGianTruoc(c.lastMessageAt)}</span>
                  </span>
                  <span className="text-[0.8125rem] text-muted">{dinhDangSo(c.customer.phone)}</span>
                  <span className={`truncate text-[0.8125rem] ${lh || chuaXem ? 'font-semibold text-ink' : 'text-body'}`}>{c.lastMessagePreview}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-[5px]">
                    <span className={`rounded-[10px] px-2 py-0.5 text-xs font-semibold ${STATUS[c.status].className}`}>{STATUS[c.status].label}</span>
                    <span className={`rounded-[10px] px-2 py-0.5 text-xs font-medium ${CHANNEL[c.channel].className}`}>{CHANNEL[c.channel].label}</span>
                    {c.assignee && <span className="text-xs text-muted">{c.assignee.fullName}</span>}
                    {c.followUp && (
                      <span
                        className={`rounded-[10px] px-2 py-0.5 text-xs font-medium ${new Date(c.followUp.at) <= new Date() ? 'bg-brand-soft text-alert-ink' : 'bg-auto text-auto-ink'}`}
                      >
                        Hẹn {gioTin(c.followUp.at)}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
          {isLoading && !data && <p className="p-6 text-center text-sm text-muted">Đang tải...</p>}
          {error && <p className="p-6 text-center text-sm text-brand-text">Không tải được danh sách. Bạn thử tải lại trang.</p>}
          {data && data.items.length === 0 && (
            <p className="p-6 text-center text-sm text-muted">{coHen ? 'Chưa có khách nào đang hẹn nhắc.' : 'Không có hội thoại nào khớp.'}</p>
          )}
          {data?.hasMore && (
            <button
              type="button"
              onClick={() => setTake((t) => Math.min(t + 100, 500))}
              className="min-h-11 w-full text-sm font-medium text-brand-text hover:bg-fill"
            >
              Xem thêm
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function NutNguon({ active, label, onClick, disabled, title }: { active: boolean; label: string; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`min-h-11 flex-auto rounded-lg px-1.5 text-[0.8125rem] font-medium disabled:text-off ${active ? 'bg-surface text-ink shadow-sm' : 'text-body'}`}
    >
      {label}
    </button>
  );
}

const AI_GUI: Record<MessageHit['senderType'], string> = { CUSTOMER: 'Khách', BOT: 'bttAI', AUTO: 'Tự động', STAFF: 'Nhân viên', SYSTEM: 'Log nội bộ' };

function KetQuaTimTin({
  q,
  data,
  error,
  isLoading,
  onSelect,
}: {
  q: string;
  data?: MessageHit[];
  error?: unknown;
  isLoading: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {q.length < 2 && <p className="p-6 text-center text-sm text-muted">Gõ ít nhất 2 ký tự, không cần dấu. Ví dụ: phu quoc thang 12</p>}
      {q.length >= 2 && isLoading && !data && <p className="p-6 text-center text-sm text-muted">Đang tìm...</p>}
      {q.length >= 2 && !!error && <p className="p-6 text-center text-sm text-brand-text">Không tìm được, bạn thử lại nhé.</p>}
      {q.length >= 2 && data && !data.length && <p className="p-6 text-center text-sm text-muted">Không có tin nhắn nào chứa “{q}”.</p>}
      {q.length >= 2 &&
        data?.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.conversationId)}
            className="flex w-full flex-col gap-0.5 border-b border-line-soft px-3.5 py-[11px] text-left hover:bg-page"
          >
            <span className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium">{m.name}</span>
              <span className="shrink-0 text-xs text-muted">{gioTin(m.createdAt)}</span>
            </span>
            <span className="line-clamp-2 break-words text-[0.8125rem] text-body">
              <span className="font-semibold">{AI_GUI[m.senderType]}:</span> {m.text}
            </span>
            <span className="text-xs text-muted">
              {CHANNEL[m.channel].label} · {dinhDangSo(m.phone)}
            </span>
          </button>
        ))}
      {data?.length === 50 && <p className="p-3 text-center text-xs text-muted">Hiện 50 tin mới nhất. Thêm từ để thu hẹp kết quả.</p>}
    </div>
  );
}
