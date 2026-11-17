import { useEffect, useRef, useState, type FormEvent } from 'react';
import useSWR from 'swr';
import { AnhNhanVien } from '@/components/AnhNhanVien';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';
import { ErrorText, inputClass, primaryClass, secondaryClass } from '@/components/ui';
import { del, fetcher, loiCua, patch, postForm } from '@/lib/api';
import type { Me } from '@/lib/types';

const VAI_TRO: Record<Me['role'], string> = {
  ADMIN: 'Quản trị hệ thống',
  DEPT_ADMIN: 'Admin phòng ban',
  DIGITAL: 'Digital (chỉ xem)',
  SALE: 'Nhân viên tư vấn',
};

/**
 * Trang cá nhân: tự đổi ảnh đại diện, họ tên, mật khẩu. Mã nhân viên, chức vụ, đơn vị chỉ xem (admin sửa ở Quản trị tài khoản).
 * Admin hệ thống và Digital không thuộc đơn vị nên không hiện dòng Đơn vị.
 */
export default function ProfilePage() {
  const { data: me, error, mutate } = useSWR<Me>('/auth/me', fetcher);
  const [ten, setTen] = useState('');
  const [luuTen, setLuuTen] = useState<'' | 'dang' | 'xong'>('');
  const [loiTen, setLoiTen] = useState('');
  const [dangAnh, setDangAnh] = useState(false);
  const [loiAnh, setLoiAnh] = useState('');
  const [doiMk, setDoiMk] = useState(false);
  const chonTep = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (me) setTen(me.fullName);
  }, [me?.fullName]);

  const guiTen = async (e: FormEvent) => {
    e.preventDefault();
    setLuuTen('dang');
    setLoiTen('');
    try {
      await patch('/auth/me', { fullName: ten });
      await mutate();
      setLuuTen('xong');
    } catch (err) {
      setLoiTen(loiCua(err));
      setLuuTen('');
    }
  };

  const doiAnh = async (file: File | undefined) => {
    if (!file) return;
    setDangAnh(true);
    setLoiAnh('');
    try {
      const form = new FormData();
      form.append('avatar', file);
      await postForm('/auth/me/avatar', form);
      await mutate();
    } catch (err) {
      setLoiAnh(loiCua(err));
    } finally {
      setDangAnh(false);
      if (chonTep.current) chonTep.current.value = '';
    }
  };

  const xoaAnh = async () => {
    setDangAnh(true);
    setLoiAnh('');
    try {
      await del('/auth/me/avatar');
      await mutate();
    } catch (err) {
      setLoiAnh(loiCua(err));
    } finally {
      setDangAnh(false);
    }
  };

  const the = 'rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-6';
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold">Trang cá nhân</h1>
        <p className="text-sm text-muted">Ảnh đại diện, họ tên và mật khẩu của bạn.</p>
      </header>

      {error && <p className="text-sm text-brand-text">Không tải được thông tin tài khoản.</p>}
      {!me && !error && <p className="text-sm text-muted">Đang tải...</p>}

      {me && (
        <>
          <section className={the} aria-labelledby="pf-anh">
            <h2 id="pf-anh" className="mb-4 font-semibold">Ảnh đại diện</h2>
            <div className="flex flex-wrap items-center gap-4">
              <AnhNhanVien ten={me.fullName} anh={me.avatarUrl} className="size-24 shrink-0 rounded-full bg-brand-soft text-3xl font-bold text-brand-text" />
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={dangAnh} onClick={() => chonTep.current?.click()} className={primaryClass}>
                    {dangAnh ? 'Đang lưu...' : me.avatarUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}
                  </button>
                  {me.avatarUrl && (
                    <button type="button" disabled={dangAnh} onClick={() => void xoaAnh()} className={secondaryClass}>
                      Xoá ảnh
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted">JPG, PNG hoặc WebP, tối đa 10 MB.</p>
                <input ref={chonTep} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Chọn ảnh đại diện" onChange={(e) => void doiAnh(e.target.files?.[0])} />
              </div>
            </div>
            <ErrorText>{loiAnh}</ErrorText>
          </section>

          <section className={the} aria-labelledby="pf-thong-tin">
            <h2 id="pf-thong-tin" className="mb-4 font-semibold">Thông tin cá nhân</h2>
            <form onSubmit={guiTen} className="flex flex-col gap-2">
              <label htmlFor="pf-ten" className="text-sm font-medium">Họ và tên</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input id="pf-ten" value={ten} maxLength={100} onChange={(e) => { setTen(e.target.value); setLuuTen(''); }} className={`${inputClass} sm:flex-1`} autoComplete="name" />
                <button type="submit" disabled={luuTen === 'dang' || ten.trim().length < 2 || ten.trim() === me.fullName} className={primaryClass}>
                  {luuTen === 'dang' ? 'Đang lưu...' : 'Lưu họ tên'}
                </button>
              </div>
              {luuTen === 'xong' && <p role="status" className="text-sm font-medium text-green-ink">Đã lưu họ tên.</p>}
              <ErrorText>{loiTen}</ErrorText>
            </form>

            <dl className="mt-5 grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-4 gap-y-3 border-t border-line-soft pt-5 text-sm">
              <dt className="text-muted">Email đăng nhập</dt>
              <dd className="break-all font-medium">{me.email}</dd>
              <dt className="text-muted">Mã nhân viên</dt>
              <dd className="font-medium">{me.employeeCode ?? <span className="text-muted">Chưa có</span>}</dd>
              <dt className="text-muted">Chức vụ</dt>
              <dd className="font-medium">{me.position ?? VAI_TRO[me.role]}</dd>
              {(me.role === 'SALE' || me.role === 'DEPT_ADMIN') && (
                <>
                  <dt className="text-muted">Đơn vị</dt>
                  <dd className="font-medium">{me.department?.name ?? <span className="text-muted">Chưa gán</span>}</dd>
                </>
              )}
              <dt className="text-muted">Vai trò</dt>
              <dd className="font-medium">{VAI_TRO[me.role]}</dd>
            </dl>
            <p className="mt-3 text-xs text-muted">Mã nhân viên, chức vụ, đơn vị do quản trị viên cập nhật.</p>
          </section>

          <section className={the} aria-labelledby="pf-mk">
            <h2 id="pf-mk" className="mb-1 font-semibold">Mật khẩu</h2>
            <p className="mb-4 text-sm text-muted">Mật khẩu mới cần ít nhất 8 ký tự.</p>
            <button type="button" onClick={() => setDoiMk(true)} className={secondaryClass}>
              Đổi mật khẩu
            </button>
          </section>
        </>
      )}
      {doiMk && <ChangePasswordDialog onClose={() => setDoiMk(false)} />}
    </main>
  );
}
