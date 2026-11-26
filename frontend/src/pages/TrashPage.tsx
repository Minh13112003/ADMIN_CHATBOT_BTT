import { useState } from 'react';
import { Link } from 'react-router';
import useSWR, { mutate as globalMutate } from 'swr';
import { AnhKhach, Dialog, ErrorText, primaryClass, secondaryClass, UnderlineTabs } from '@/components/ui';
import { ApiError, del, fetcher, loiCua, post } from '@/lib/api';
import { CHANNEL } from '@/lib/labels';
import type { Attachment, Channel, Message } from '@/lib/types';

type HoiThoaiXoa = {
  id: string;
  channel: Channel;
  status: string;
  deletedAt: string;
  deletedBy: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  messageCount: number;
  confirmedDeals: number;
  customer: { id: string; name: string; phone: string | null; avatarUrl: string | null };
};
type TinXoa = {
  id: string;
  conversationId: string;
  senderType: Message['senderType'];
  staffLabel: string | null;
  text: string;
  internal: boolean;
  createdAt: string;
  deletedAt: string;
  deletedBy: string | null;
  attachment: Attachment | null;
  conversation: { channel: Channel; customer: { name: string; phone: string | null } };
};
type Trang<T> = { items: T[]; nextBefore: string | null };

const NUT = 'inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[10px] border border-field bg-surface px-4 text-sm font-semibold hover:bg-fill disabled:opacity-60 max-sm:px-2';

const NGUOI_GUI: Record<Message['senderType'], string> = { CUSTOMER: 'Khách', BOT: 'bttAI', AUTO: 'Tự động', STAFF: 'Nhân viên', SYSTEM: 'Nhật ký' };
const luc = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Làm mới các danh sách liên quan sau khi khôi phục / xoá hẳn. */
const lamMoi = () => void globalMutate((k) => typeof k === 'string' && (k.startsWith('/trash/') || k.startsWith('/conversations') || k.startsWith('/customers') || k.startsWith('/stats')));

function KenhChip({ c }: { c: Channel }) {
  return <span className="rounded-md bg-fill px-1.5 py-px text-[0.6875rem] font-semibold text-body">{CHANNEL[c]?.label ?? c}</span>;
}

/** Danh sách có nút "Xem thêm" theo mốc thời gian xoá. */
function useTrang<T extends { deletedAt: string }>(duong: string) {
  const { data, error, isLoading, mutate } = useSWR<Trang<T>>(duong, fetcher);
  const [them, setThem] = useState<T[]>([]);
  const [moc, setMoc] = useState<string | null | undefined>(undefined);
  const [dang, setDang] = useState(false);
  const tiep = moc === undefined ? data?.nextBefore : moc;
  const taiThem = async () => {
    if (!tiep) return;
    setDang(true);
    try {
      const r = await fetcher<Trang<T>>(`${duong}?before=${encodeURIComponent(tiep)}`);
      setThem((t) => [...t, ...r.items]);
      setMoc(r.nextBefore);
    } finally {
      setDang(false);
    }
  };
  const datLai = () => {
    setThem([]);
    setMoc(undefined);
    void mutate();
  };
  return { items: [...(data?.items ?? []), ...them], data, error, isLoading, coThem: !!tiep, dang, taiThem, datLai };
}

export default function TrashPage() {
  const [tab, setTab] = useState<'conv' | 'msg'>('conv');
  const hoiThoai = useTrang<HoiThoaiXoa>('/trash/conversations');
  const tin = useTrang<TinXoa>('/trash/messages');
  const [xem, setXem] = useState<HoiThoaiXoa | null>(null);
  const [xoaHan, setXoaHan] = useState<{ loai: 'conv'; v: HoiThoaiXoa } | { loai: 'msg'; v: TinXoa } | null>(null);
  const [dangKhoiPhuc, setDangKhoiPhuc] = useState<string | null>(null);
  const [thongBao, setThongBao] = useState<{ chu: string; loi?: boolean } | null>(null);

  const khoiPhuc = async (loai: 'conv' | 'msg', id: string) => {
    setDangKhoiPhuc(id);
    setThongBao(null);
    try {
      await post(`/trash/${loai === 'conv' ? 'conversations' : 'messages'}/${id}/restore`);
      setThongBao({ chu: loai === 'conv' ? 'Đã khôi phục hội thoại, hội thoại đã hiện lại ở Hội thoại.' : 'Đã khôi phục tin nhắn.' });
      (loai === 'conv' ? hoiThoai : tin).datLai();
      lamMoi();
    } catch (e) {
      setThongBao({ chu: loiCua(e), loi: true });
    } finally {
      setDangKhoiPhuc(null);
    }
  };

  const soHoiThoai = hoiThoai.data ? `${hoiThoai.items.length}${hoiThoai.coThem ? '+' : ''}` : '';
  const soTin = tin.data ? `${tin.items.length}${tin.coThem ? '+' : ''}` : '';

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-6 max-md:p-4">
      <header className="min-w-0">
        <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted">Quản trị / Admin toàn quyền</p>
        <h1 className="mt-1 text-xl font-bold">Khôi phục</h1>
        <p className="mt-0.5 text-[0.8125rem] text-muted">Hội thoại và tin nhắn đã xoá. Khôi phục để hiện lại như cũ, hoặc xoá hẳn khỏi database.</p>
      </header>

      {thongBao && (
        <p role={thongBao.loi ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${thongBao.loi ? 'border-alert-line bg-brand-faint text-brand-text' : 'border-line bg-green-soft text-green-ink'}`}>
          {thongBao.chu}
        </p>
      )}

      <section className="min-w-0 rounded-2xl border border-line bg-surface shadow-sm">
        <div className="border-b border-line px-4">
          <UnderlineTabs
            label="Loại dữ liệu đã xoá"
            value={tab}
            onChange={setTab}
            items={[
              { key: 'conv', label: <>Hội thoại đã xoá {soHoiThoai && <span className="ml-1 rounded-full bg-fill px-1.5 text-xs">{soHoiThoai}</span>}</> },
              { key: 'msg', label: <>Tin nhắn đã xoá {soTin && <span className="ml-1 rounded-full bg-fill px-1.5 text-xs">{soTin}</span>}</> },
            ]}
          />
        </div>

        {tab === 'conv' && (
          <div>
            {hoiThoai.isLoading && <p role="status" className="p-8 text-center text-sm text-muted">Đang tải...</p>}
            {hoiThoai.error && <p role="alert" className="p-8 text-center text-sm text-brand-text">Không tải được danh sách. <button type="button" className="underline" onClick={hoiThoai.datLai}>Thử lại</button></p>}
            {hoiThoai.data && hoiThoai.items.length === 0 && <p className="p-10 text-center text-sm text-muted">Không có hội thoại nào đã xoá.</p>}
            <ul className="divide-y divide-line">
              {hoiThoai.items.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 p-4 max-sm:flex-col max-sm:items-stretch">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <AnhKhach ten={c.customer.name} anh={c.customer.avatarUrl} className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-soft text-sm font-bold text-neutral-ink" />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold">{c.customer.name}</span>
                        <KenhChip c={c.channel} />
                        {c.confirmedDeals > 0 && <span className="rounded-md bg-green-soft px-1.5 py-px text-[0.6875rem] font-semibold text-green-ink">{c.confirmedDeals} đơn đã chốt</span>}
                      </p>
                      {c.customer.phone && <p className="text-[0.8125rem] text-muted">{c.customer.phone}</p>}
                      {c.lastMessagePreview && <p className="mt-1 line-clamp-1 break-all text-sm text-body">{c.lastMessagePreview}</p>}
                      <p className="mt-1 text-xs text-muted">
                        {c.messageCount} tin · Xoá lúc {luc(c.deletedAt)}{c.deletedBy ? ` bởi ${c.deletedBy}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 max-sm:grid max-sm:grid-cols-3">
                    <button type="button" onClick={() => setXem(c)} className={`${NUT} text-ink`}>Xem</button>
                    <button type="button" disabled={dangKhoiPhuc === c.id} onClick={() => void khoiPhuc('conv', c.id)} className={`${NUT} text-green-ink`}>
                      {dangKhoiPhuc === c.id ? 'Đang...' : 'Khôi phục'}
                    </button>
                    <button type="button" onClick={() => setXoaHan({ loai: 'conv', v: c })} className={`${NUT} text-brand-text hover:bg-brand-faint`}>Xoá hẳn</button>
                  </div>
                </li>
              ))}
            </ul>
            {hoiThoai.coThem && (
              <div className="border-t border-line p-4 text-center">
                <button type="button" disabled={hoiThoai.dang} onClick={() => void hoiThoai.taiThem()} className={secondaryClass}>{hoiThoai.dang ? 'Đang tải...' : 'Xem thêm'}</button>
              </div>
            )}
          </div>
        )}

        {tab === 'msg' && (
          <div>
            {tin.isLoading && <p role="status" className="p-8 text-center text-sm text-muted">Đang tải...</p>}
            {tin.error && <p role="alert" className="p-8 text-center text-sm text-brand-text">Không tải được danh sách. <button type="button" className="underline" onClick={tin.datLai}>Thử lại</button></p>}
            {tin.data && tin.items.length === 0 && <p className="p-10 text-center text-sm text-muted">Không có tin nhắn nào đã xoá.</p>}
            <ul className="divide-y divide-line">
              {tin.items.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 p-4 max-sm:flex-col max-sm:items-stretch">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-semibold">{m.conversation.customer.name}</span>
                      <KenhChip c={m.conversation.channel} />
                      <span className="text-xs text-muted">{m.senderType === 'STAFF' ? (m.staffLabel ?? 'Nhân viên') : NGUOI_GUI[m.senderType]} · gửi {luc(m.createdAt)}</span>
                    </p>
                    <blockquote className="mt-1.5 line-clamp-3 whitespace-pre-line break-words rounded-lg border-l-[3px] border-field bg-fill px-3 py-1.5 text-sm">
                      {m.text || (m.attachment ? `[Tệp: ${m.attachment.name}]` : '[Không có chữ]')}
                    </blockquote>
                    <p className="mt-1 text-xs text-muted">Xoá lúc {luc(m.deletedAt)}{m.deletedBy ? ` bởi ${m.deletedBy}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 max-sm:grid max-sm:grid-cols-3">
                    <Link to={`/inbox?c=${m.conversationId}`} className={`${NUT} text-ink`}>Mở chat</Link>
                    <button type="button" disabled={dangKhoiPhuc === m.id} onClick={() => void khoiPhuc('msg', m.id)} className={`${NUT} text-green-ink`}>
                      {dangKhoiPhuc === m.id ? 'Đang...' : 'Khôi phục'}
                    </button>
                    <button type="button" onClick={() => setXoaHan({ loai: 'msg', v: m })} className={`${NUT} text-brand-text hover:bg-brand-faint`}>Xoá hẳn</button>
                  </div>
                </li>
              ))}
            </ul>
            {tin.coThem && (
              <div className="border-t border-line p-4 text-center">
                <button type="button" disabled={tin.dang} onClick={() => void tin.taiThem()} className={secondaryClass}>{tin.dang ? 'Đang tải...' : 'Xem thêm'}</button>
              </div>
            )}
          </div>
        )}
      </section>

      {xem && <XemHoiThoaiDialog c={xem} onClose={() => setXem(null)} />}
      {xoaHan && (
        <XoaHanDialog
          muc={xoaHan}
          onClose={() => setXoaHan(null)}
          onXong={() => {
            const loai = xoaHan.loai;
            setXoaHan(null);
            setThongBao({ chu: loai === 'conv' ? 'Đã xoá hẳn hội thoại khỏi database.' : 'Đã xoá hẳn tin nhắn khỏi database.' });
            (loai === 'conv' ? hoiThoai : tin).datLai();
            lamMoi();
          }}
        />
      )}
    </main>
  );
}

/** Xem nội dung hội thoại đã xoá trước khi quyết định khôi phục hay xoá hẳn (100 tin gần nhất). */
function XemHoiThoaiDialog({ c, onClose }: { c: HoiThoaiXoa; onClose: () => void }) {
  const { data, error } = useSWR<(Message & { attachment: Attachment | null })[]>(`/trash/conversations/${c.id}/messages`, fetcher);
  return (
    <Dialog title={`Hội thoại với ${c.customer.name}`} onClose={onClose}>
      <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto rounded-xl bg-page p-3">
        {!data && !error && <p role="status" className="text-center text-sm text-muted">Đang tải...</p>}
        {error && <p role="alert" className="text-center text-sm text-brand-text">Không tải được nội dung.</p>}
        {data?.length === 0 && <p className="text-center text-sm text-muted">Hội thoại không có tin nào.</p>}
        {data?.map((m) =>
          m.senderType === 'SYSTEM' ? (
            <p key={m.id} className="self-center rounded-xl bg-auto px-3 py-1 text-center text-xs text-auto-ink">{m.text}</p>
          ) : (
            <div key={m.id} className={`max-w-[85%] ${m.senderType === 'CUSTOMER' ? 'self-start' : 'self-end text-right'}`}>
              <p className="text-[0.6875rem] text-muted">{m.senderType === 'STAFF' ? (m.staffLabel ?? 'Nhân viên') : NGUOI_GUI[m.senderType]} · {luc(m.createdAt)}</p>
              <p className={`inline-block whitespace-pre-line break-words rounded-2xl px-3 py-1.5 text-left text-sm ${m.senderType === 'CUSTOMER' ? 'border border-line bg-surface' : 'bg-neutral-soft'}`}>
                {m.text || (m.attachment ? `[Tệp: ${m.attachment.name}]` : '')}
              </p>
            </div>
          ),
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onClose} className={secondaryClass}>Đóng</button>
      </div>
    </Dialog>
  );
}

/** Xoá hẳn khỏi database, không khôi phục được. Hội thoại có đơn đã chốt thì hỏi thêm một lần vì doanh thu thống kê giảm. */
function XoaHanDialog({ muc, onClose, onXong }: { muc: { loai: 'conv'; v: HoiThoaiXoa } | { loai: 'msg'; v: TinXoa }; onClose: () => void; onXong: () => void }) {
  const [canXacNhanDon, setCanXacNhanDon] = useState(false);
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState('');
  const xoa = async () => {
    setDang(true);
    setLoi('');
    try {
      if (muc.loai === 'conv') await del(`/trash/conversations/${muc.v.id}${canXacNhanDon ? '?force=1' : ''}`);
      else await del(`/trash/messages/${muc.v.id}`);
      onXong();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'HAS_DEALS') setCanXacNhanDon(true);
      else setLoi(loiCua(e));
      setDang(false);
    }
  };
  const ten = muc.loai === 'conv' ? muc.v.customer.name : muc.v.conversation.customer.name;
  return (
    <Dialog title={muc.loai === 'conv' ? 'Xoá hẳn hội thoại' : 'Xoá hẳn tin nhắn'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          {muc.loai === 'conv' ? (
            <>Xoá hẳn hội thoại với <strong>{ten}</strong>? Toàn bộ tin nhắn, đơn, nhãn tour quan tâm và file đính kèm sẽ bị xoá khỏi database, <strong>không khôi phục được</strong>. Nếu khách không còn hội thoại nào khác thì khách cũng bị xoá.</>
          ) : (
            <>Xoá hẳn tin nhắn này của hội thoại với <strong>{ten}</strong> khỏi database? <strong>Không khôi phục được.</strong></>
          )}
        </p>
        {canXacNhanDon && (
          <p role="alert" className="rounded-lg border border-alert-line bg-brand-faint px-3 py-2 text-sm text-brand-text">
            Hội thoại này có đơn đã chốt đang tính vào doanh thu. Xoá hẳn sẽ làm số liệu doanh thu giảm theo. Bạn vẫn muốn xoá?
          </p>
        )}
        <ErrorText>{loi}</ErrorText>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryClass}>Huỷ</button>
          <button type="button" disabled={dang} onClick={() => void xoa()} className={primaryClass}>{dang ? 'Đang xoá...' : canXacNhanDon ? 'Vẫn xoá hẳn' : 'Xoá hẳn'}</button>
        </div>
      </div>
    </Dialog>
  );
}
