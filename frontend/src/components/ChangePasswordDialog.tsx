import { useState, type FormEvent } from 'react';
import { loiCua, post } from '@/lib/api';
import { Dialog, ErrorText, Field, inputClass, primaryClass, secondaryClass } from './ui';

export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [cu, setCu] = useState('');
  const [moi, setMoi] = useState('');
  const [loi, setLoi] = useState('');
  const [xong, setXong] = useState(false);
  const [dangGui, setDangGui] = useState(false);

  const gui = async (e: FormEvent) => {
    e.preventDefault();
    setDangGui(true);
    setLoi('');
    try {
      await post('/auth/change-password', { currentPassword: cu, newPassword: moi });
      setXong(true);
    } catch (err) {
      setLoi(loiCua(err));
    } finally {
      setDangGui(false);
    }
  };

  return (
    <Dialog title="Đổi mật khẩu" onClose={onClose}>
      {xong ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-body">Đã đổi mật khẩu.</p>
          <button type="button" onClick={onClose} className={primaryClass}>
            Đóng
          </button>
        </div>
      ) : (
        <form onSubmit={gui} className="flex flex-col gap-3">
          <Field label="Mật khẩu hiện tại">
            <input type="password" autoComplete="current-password" required value={cu} onChange={(e) => setCu(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Mật khẩu mới (ít nhất 8 ký tự)">
            <input type="password" autoComplete="new-password" required minLength={8} value={moi} onChange={(e) => setMoi(e.target.value)} className={inputClass} />
          </Field>
          <ErrorText>{loi}</ErrorText>
          <div className="mt-1 flex justify-end gap-2">
            <button type="button" onClick={onClose} className={secondaryClass}>
              Huỷ
            </button>
            <button type="submit" disabled={dangGui} className={primaryClass}>
              Lưu
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
