import { useState } from 'react';
import useSWR from 'swr';
import { api, del, fetcher, loiCua } from '@/lib/api';
import { ErrorText, inputClass, Modal, primaryClass, secondaryClass } from './ui';

type Field = { name: string; label: string; secret: boolean; hint?: string; set: boolean; preview: string | null; updatedAt: string | null };
type Settings = { encryptionReady: boolean; fields: Field[]; urls?: { webhook: string; callback: string } };

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
type TienDo = { dang: boolean; tong: number; xong: number; khachMoi: number; tinThem: number; loi: number; lyDo: string | null; ketThuc: string | null };

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
      <p className="text-xs text-body">Lấy các khách đã nhắn OA trước khi kết nối (tối đa 300 khách gần nhất) cùng tin cũ của họ. Khách hiện trong Hộp thư với trạng thái <strong>Đã xem</strong>, không báo nhân viên. Cần kết nối Zalo xong trước. Có thể mất vài phút, bạn đóng hộp này cũng được.</p>
      {data?.dang && (
        <p role="status" className="text-sm font-medium">Đang nhập: {data.xong}/{data.tong || '?'} khách, đã thêm {data.khachMoi} khách mới và {data.tinThem} tin{data.loi ? `, ${data.loi} lỗi` : ''}...</p>
      )}
      {xongRoi && !data.lyDo && (
        <p role="status" className="rounded-lg border border-green-soft bg-green-soft/40 px-3 py-2 text-sm text-green-ink">
          Xong: {data.xong} khách ({data.khachMoi} khách mới), thêm {data.tinThem} tin{data.loi ? `, ${data.loi} khách lỗi` : ''}. Tải lại Hộp thư để xem.
        </p>
      )}
      {xongRoi && data.lyDo && <ErrorText>{data.lyDo}</ErrorText>}
      <ErrorText>{loi}</ErrorText>
      <button type="button" disabled={data?.dang} onClick={() => void bat()} className={`${secondaryClass} self-start`}>{data?.dang ? 'Đang nhập...' : xongRoi ? 'Nhập lại' : 'Nhập khách cũ từ Zalo'}</button>
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
            <button type="button" disabled={dang} onClick={() => (hoiXoa ? void xoa() : setHoiXoa(true))} className="min-h-11 rounded-[10px] px-3 text-sm font-semibold text-brand-text hover:bg-brand-soft">
              {hoiXoa ? 'Bấm lần nữa để xoá hết thông tin' : 'Xoá thông tin đã lưu'}
            </button>
          )}
          <span className="flex-1" />
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
                    className="min-h-11 shrink-0 rounded-[10px] border border-field px-3 text-sm font-semibold hover:bg-fill"
                  >
                    {khoaLai ? 'Thay đổi' : 'Huỷ'}
                  </button>
                )}
              </div>
              {f.hint && <small className="text-xs text-muted">{f.hint}</small>}
            </div>
          );
        })}
        {data?.urls && (
          <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-page p-3">
            <p className="text-xs font-semibold">Khai hai địa chỉ này trong ứng dụng Zalo (developers.zalo.me)</p>
            <DiaChi nhan="Webhook URL (Zalo gửi tin khách về đây)" gia={data.urls.webhook} />
            <DiaChi nhan="Callback URL (Zalo quay về sau khi cấp quyền)" gia={data.urls.callback} />
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
        <p className="text-xs text-muted">Sau khi lưu, kênh chỉ chuyển sang "Đã kết nối" khi nhận được tin thật đầu tiên từ khách.</p>
      </div>
    </Modal>
  );
}
