import { useState } from 'react';
import useSWR from 'swr';
import { api, del, fetcher, loiCua } from '@/lib/api';
import { ErrorText, inputClass, Modal, primaryClass, secondaryClass } from './ui';

type Field = { name: string; label: string; secret: boolean; hint?: string; set: boolean; preview: string | null; updatedAt: string | null };
type Settings = { encryptionReady: boolean; fields: Field[]; urls?: { webhook: string; callback?: string }; connected?: boolean };
type KetQuaKiemTra = { ok: boolean; trang: { id: string; name: string } | null; buoc: { ten: string; ok: boolean; loi?: string }[]; loi: string | null };

const IconTron = ({ ok }: { ok: boolean }) => (
  <span aria-hidden="true" className={`grid size-14 place-items-center rounded-full ${ok ? 'bg-green-soft text-green-ink' : 'bg-brand-soft text-brand-text'}`}>
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{ok ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <path d="M7 7l10 10M17 7 7 17" />}</svg>
  </span>
);

/**
 * Kiểm tra kết nối Facebook: đang chạy thì hiện vòng xoay (không đóng được), xong thì báo thành công / thất bại kèm từng bước.
 * Backend tự kiểm tra token, tự đăng ký webhook và đăng ký Trang (POST /channel-settings/facebook/test).
 */
function HopKiemTraFacebook({ kq, onClose }: { kq: KetQuaKiemTra | 'dang'; onClose: () => void }) {
  if (kq === 'dang') {
    return (
      <Modal title="Đang kết nối với Facebook" onClose={() => undefined} width={420}>
        <div role="status" className="flex flex-col items-center gap-4 py-6 text-center">
          <span aria-hidden="true" className="size-12 animate-spin rounded-full border-4 border-fill border-t-brand" />
          <p className="text-sm text-body">Đang kiểm tra token, đăng ký webhook và đăng ký Trang nhận tin nhắn. Có thể mất vài giây...</p>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title={kq.ok ? 'Kết nối thành công' : 'Kết nối thất bại'} onClose={onClose} width={480} footer={<button type="button" onClick={onClose} className={primaryClass}>Đóng</button>}>
      <div role={kq.ok ? 'status' : 'alert'} className="flex min-w-0 flex-col items-center gap-3 text-center [overflow-wrap:anywhere]">
        <IconTron ok={kq.ok} />
        <p className="text-sm">
          {kq.ok
            ? <>Đã kết nối với Trang <strong>{kq.trang?.name}</strong>. Tin nhắn Messenger của khách sẽ về Hộp thư. Thẻ Facebook ở trang Kênh kết nối đã chuyển sang <strong>Đã kết nối</strong>.</>
            : <>{kq.loi}</>}
        </p>
      </div>
      {kq.buoc.length > 0 && (
        <ol className="mt-4 flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-page p-3 text-left text-[0.8125rem] [overflow-wrap:anywhere]">
          {kq.buoc.map((b) => (
            <li key={b.ten} className="flex gap-2">
              <span aria-hidden="true" className={`mt-0.5 shrink-0 font-bold ${b.ok ? 'text-green-ink' : 'text-brand-text'}`}>{b.ok ? '✓' : '✕'}</span>
              <span className="min-w-0"><span className="sr-only">{b.ok ? 'Đạt: ' : 'Lỗi: '}</span>{b.ten}{b.loi && <span className="block text-xs text-muted">{b.loi}</span>}</span>
            </li>
          ))}
        </ol>
      )}
      {kq.ok && <p className="mt-3 text-xs text-muted">Ứng dụng Meta đang ở chế độ thử thì chỉ tài khoản có vai trò trong ứng dụng nhắn tới mới vào được. Mở cho mọi khách: chuyển ứng dụng sang chế độ Live.</p>}
    </Modal>
  );
}

function DiaChi({ nhan, gia }: { nhan: string; gia: string }) {
  const [daChep, setDaChep] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-body">{nhan}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-fill px-2.5 py-2 text-xs">{gia}</code>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(gia).then(() => { setDaChep(true); setTimeout(() => setDaChep(false), 1500); }); }} className="min-h-9 shrink-0 rounded-lg border border-field px-2.5 text-xs font-semibold hover:bg-fill">{daChep ? 'Đã chép' : 'Chép'}</button>
      </div>
    </div>
  );
}

/** Hộp nhập thông tin kết nối Zalo OA / Facebook. Giá trị bí mật chỉ gửi lên, không bao giờ hiện lại (chỉ thấy đuôi 4 ký tự). */
type TienDo = { dang: boolean; tong: number; xong: number; khachMoi: number; tinThem: number; loi: number; lyDo: string | null; ketThuc: string | null; soNgay: number | null; tinZalo?: number; cuNhat?: string | null; loiDau?: string | null; tuNgay?: string | null };

/** Nhập các khách đã nhắn OA từ trước khi nối (webhook chỉ báo tin mới). Chạy nền ở server, đây chỉ bấm và xem tiến độ. */
function NhapKhachCu() {
  const { data, mutate } = useSWR<TienDo>('/channel-settings/zalo/import-status', fetcher, { refreshInterval: (d) => (d?.dang ? 2000 : 0) });
  const [loi, setLoi] = useState('');
  const bat = async () => {
    setLoi('');
    try {
      await api('/channel-settings/zalo/import-old', { method: 'POST', body: {} });
      await mutate();
    } catch (e) {
      setLoi(loiCua(e));
    }
  };
  const xongRoi = data && !data.dang && data.ketThuc;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-page p-3">
      <p className="text-xs text-body">Lấy mọi khách đã nhắn OA trong <strong>30 ngày gần đây</strong> cùng toàn bộ tin của họ trong khoảng đó (tin đã có thì bỏ qua), rồi tự nhận diện địa điểm khách quan tâm theo ngày của từng tin. Khách mới hiện trong Hộp thư với trạng thái <strong>Đã xem</strong>, không báo nhân viên. Cần kết nối Zalo xong trước. Có thể mất vài phút, bạn đóng hộp này cũng được.</p>
      {data?.dang && (
        <p role="status" className="text-sm font-medium">Đang lấy: {data.xong}/{data.tong || '?'} khách, đã thêm {data.khachMoi} khách mới và {data.tinThem} tin{data.loi ? `, ${data.loi} lỗi` : ''}...</p>
      )}
      {xongRoi && !data.lyDo && (
        <p role="status" className="rounded-lg border border-green-soft bg-green-soft/40 px-3 py-2 text-sm text-green-ink">
          Xong: {data.xong} khách ({data.khachMoi} khách mới), thêm {data.tinThem} tin mới{data.loi ? `, ${data.loi} khách lỗi` : ''}. Tải lại Hộp thư để xem.
          <span className="mt-1 block text-xs text-body">
            Zalo trả {data.tinZalo ?? 0} tin trong khoảng từ {data.tuNgay ? new Date(data.tuNgay).toLocaleDateString('vi-VN') : '30 ngày trước'}
            {data.cuNhat ? `, tin cũ nhất ngày ${new Date(data.cuNhat).toLocaleDateString('vi-VN')}` : ''}; {Math.max(0, (data.tinZalo ?? 0) - data.tinThem)} tin đã có sẵn nên bỏ qua.
            {data.loiDau ? ` Lỗi đầu tiên: ${data.loiDau}` : ''}
          </span>
        </p>
      )}
      {xongRoi && data.lyDo && <ErrorText>{data.lyDo}</ErrorText>}
      <ErrorText>{loi}</ErrorText>
      <button type="button" disabled={data?.dang} onClick={() => void bat()} className={`${secondaryClass} self-start`}>{data?.dang ? 'Đang lấy...' : xongRoi ? 'Lấy lại' : 'Lấy tin 30 ngày từ Zalo'}</button>
    </div>
  );
}

export function ChannelConnectDialog({ channel, title, onClose, onSaved }: { channel: 'ZALO' | 'FACEBOOK'; title: string; onClose: () => void; onSaved: () => void }) {
  const key = `/channel-settings/${channel}`;
  const { data, error, mutate } = useSWR<Settings>(key, fetcher);
  const [values, setValues] = useState<Record<string, string>>({});
  const [sua, setSua] = useState<Record<string, boolean>>({});
  const [loi, setLoi] = useState('');
  const [dang, setDang] = useState(false);
  const [hoiXoa, setHoiXoa] = useState(false);
  const [kiemTra, setKiemTra] = useState<KetQuaKiemTra | 'dang' | null>(null);
  const laFb = channel === 'FACEBOOK';
  const duTruong = !!data?.fields.length && data.fields.every((f) => f.set);

  const chayKiemTra = async () => {
    setKiemTra('dang');
    try {
      const r = await api<KetQuaKiemTra>('/channel-settings/facebook/test', { method: 'POST', body: {} });
      setKiemTra(r);
    } catch (e) {
      setKiemTra({ ok: false, trang: null, buoc: [], loi: loiCua(e) });
    }
    await mutate();
    onSaved();
  };

  const ketNoiZalo = async () => {
    setDang(true);
    setLoi('');
    try {
      const r = await api<{ url: string }>('/channel-settings/zalo/connect-url');
      window.location.href = r.url;
    } catch (e) {
      setLoi(loiCua(e));
      setDang(false);
    }
  };
  const coNhap = Object.values(values).some((v) => v.trim());
  const luu = async () => {
    setDang(true);
    setLoi('');
    try {
      const r = await api<Settings>(key, { method: 'PUT', body: { values } });
      await mutate(r, { revalidate: false });
      setValues({});
      setSua({});
      onSaved();
      // Facebook: đủ thông tin thì tự kiểm tra kết nối ngay sau khi lưu.
      if (laFb && r.fields.every((f) => f.set)) {
        setDang(false);
        await chayKiemTra();
      }
    } catch (e) {
      setLoi(loiCua(e));
    } finally {
      setDang(false);
    }
  };
  const xoa = async () => {
    setDang(true);
    setLoi('');
    try {
      await del(key);
      await mutate();
      setHoiXoa(false);
      onSaved();
    } catch (e) {
      setLoi(loiCua(e));
    } finally {
      setDang(false);
    }
  };

  return (
    <Modal
      title={`Kết nối ${title}`}
      subtitle="Thông tin được mã hoá trước khi lưu trong database. Khoá bí mật và token chỉ hiện 5 ký tự cuối, không ai xem lại được giá trị đầy đủ."
      onClose={onClose}
      width={560}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {data?.fields.some((f) => f.set) && (
            <button type="button" disabled={dang} onClick={() => (hoiXoa ? void xoa() : setHoiXoa(true))} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-brand-text hover:bg-brand-soft">
              {hoiXoa ? 'Bấm lần nữa để xoá hết thông tin' : 'Xoá thông tin đã lưu'}
            </button>
          )}
          <span className="flex-1" />
          {laFb && duTruong && !coNhap && (
            <button type="button" disabled={dang || kiemTra === 'dang'} onClick={() => void chayKiemTra()} className={secondaryClass}>Kiểm tra kết nối</button>
          )}
          <button type="button" onClick={onClose} className={secondaryClass}>Đóng</button>
          <button type="button" disabled={dang || !coNhap || !data?.encryptionReady} onClick={() => void luu()} className={primaryClass}>
            {dang ? 'Đang lưu...' : 'Lưu thông tin'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {!data && !error && <p className="text-sm text-muted">Đang tải...</p>}
        {error && <ErrorText>{loiCua(error)}</ErrorText>}
        {data && !data.encryptionReady && (
          <p role="alert" className="rounded-lg border border-amber-line bg-auto-soft px-3 py-2 text-sm text-amber-ink">
            Máy chủ chưa có khoá mã hoá (ENCRYPTION_KEY trong file .env), nên chưa lưu được. Nhờ người quản trị server thêm khoá rồi khởi động lại backend.
          </p>
        )}
        {data?.fields.map((f) => {
          // Đã lưu: ô khoá lại, chỉ thấy bản che (bí mật chỉ lộ 5 ký tự cuối). Bấm "Thay đổi" thì ô trống để nhập giá trị mới.
          const khoaLai = f.set && !sua[f.name];
          return (
            <div key={f.name} className="flex flex-col gap-1.5">
              <label htmlFor={`kn-${f.name}`} className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
                {f.label}
                {f.set && <span className="rounded-full bg-green-soft px-2 py-0.5 text-xs font-semibold text-green-ink">Đã nhập</span>}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`kn-${f.name}`}
                  type={f.secret && !khoaLai ? 'password' : 'text'}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={khoaLai}
                  value={khoaLai ? (f.preview ?? '') : (values[f.name] ?? '')}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  placeholder={f.set ? 'Nhập giá trị mới (để trống = giữ nguyên)' : 'Chưa nhập'}
                  className={`${inputClass} min-w-0 flex-1 disabled:bg-fill disabled:text-muted`}
                />
                {f.set && (
                  <button
                    type="button"
                    onClick={() => {
                      setSua((x) => ({ ...x, [f.name]: !x[f.name] }));
                      setValues((v) => ({ ...v, [f.name]: '' }));
                    }}
                    className="min-h-11 shrink-0 rounded-lg border border-field px-3 text-sm font-semibold hover:bg-fill"
                  >
                    {khoaLai ? 'Thay đổi' : 'Huỷ'}
                  </button>
                )}
              </div>
              {f.hint && <small className="text-xs text-muted">{f.hint}</small>}
            </div>
          );
        })}
        {laFb && data && (
          <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${data.connected ? 'border-green-soft bg-green-soft/40 text-green-ink' : 'border-line bg-page text-body'}`}>
            {data.connected ? 'Đã kết nối: lần kiểm tra gần nhất thành công.' : duTruong ? 'Đã nhập đủ thông tin nhưng chưa kết nối được. Bấm "Kiểm tra kết nối" để thử lại.' : 'Nhập đủ 5 ô rồi bấm Lưu: hệ thống tự kiểm tra và tự khai webhook với Meta (không cần nhập mã xác minh bên trang Meta).'}
          </p>
        )}
        {laFb && data?.urls && (
          <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-page p-3">
            <p className="text-xs text-body">Hệ thống tự khai địa chỉ này với Meta khi kiểm tra kết nối. Chỉ cần chép khi muốn khai tay trong Cài đặt API Messenger → Cấu hình webhook.</p>
            <DiaChi nhan="URL gọi lại (Callback URL)" gia={data.urls.webhook} />
          </div>
        )}
        {!laFb && data?.urls && (
          <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-page p-3">
            <p className="text-xs font-semibold">Khai hai địa chỉ này trong ứng dụng Zalo (developers.zalo.me)</p>
            <DiaChi nhan="Webhook URL (Zalo gửi tin khách về đây)" gia={data.urls.webhook} />
            {data.urls.callback && <DiaChi nhan="Callback URL (Zalo quay về sau khi cấp quyền)" gia={data.urls.callback} />}
          </div>
        )}
        {channel === 'ZALO' && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-page p-3">
            <p className="text-xs text-body">Sau khi lưu App ID và khoá bí mật, bấm nút dưới, đăng nhập Zalo bằng tài khoản quản trị OA và đồng ý cấp quyền. Hệ thống tự lấy và tự làm mới token, bạn không phải dán token.</p>
            <button type="button" disabled={dang || !data?.fields.find((f) => f.name === 'appId')?.set || !data?.fields.find((f) => f.name === 'appSecret')?.set} onClick={() => void ketNoiZalo()} className={`${primaryClass} self-start`}>Kết nối với Zalo</button>
          </div>
        )}
        {channel === 'ZALO' && <NhapKhachCu />}
        <ErrorText>{loi}</ErrorText>
        {!laFb && <p className="text-xs text-muted">Sau khi lưu, kênh chỉ chuyển sang "Đã kết nối" khi nhận được tin thật đầu tiên từ khách.</p>}
      </div>
      {kiemTra && <HopKiemTraFacebook kq={kiemTra} onClose={() => setKiemTra(null)} />}
    </Modal>
  );
}
