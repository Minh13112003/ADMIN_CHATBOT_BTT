import { useState, type FormEvent } from 'react';
import { mutate as globalMutate } from 'swr';
import { loiCua, post } from '@/lib/api';
import type { Conversation } from '@/lib/types';
import { ErrorText, inputClass, Modal, primaryClass, secondaryClass } from '../ui';

/**
 * Nhập số điện thoại cho khách (khách Zalo không có sẵn số, sale xin rồi nhập). Dùng ở menu ⋯ và làm "cổng" trước khi chốt tour.
 * `lyDo` chỉ để giải thích vì sao đang hỏi số.
 */
export function SoDienThoaiDialog({ conv, lyDo, onClose, onXong }: { conv: Conversation; lyDo?: string; onClose: () => void; onXong?: (c: Conversation) => void }) {
  const [so, setSo] = useState(conv.customer.phone ?? '');
  const [loi, setLoi] = useState('');
  const [dang, setDang] = useState(false);

  const luu = async (e: FormEvent) => {
    e.preventDefault();
    if (!so.trim()) {
      setLoi('Nhập số điện thoại');
      return;
    }
    setDang(true);
    setLoi('');
    try {
      const c = await post<Conversation>(`/conversations/${conv.id}/customer-phone`, { phone: so });
      // Làm mới dữ liệu hội thoại ở mọi nơi đang hiển thị (khung chat, danh sách).
      await globalMutate((k) => typeof k === 'string' && k.startsWith('/conversations'), undefined, { revalidate: true });
      onXong?.(c);
      onClose();
    } catch (err) {
      setLoi(loiCua(err));
      setDang(false);
    }
  };

  return (
    <Modal
      title="Số điện thoại của khách"
      subtitle={lyDo ?? `Khách: ${conv.customer.name}`}
      onClose={onClose}
      width={440}
      footer={
        <div className="flex w-full justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryClass}>Huỷ</button>
          <button type="submit" form="form-sdt" disabled={dang} className={primaryClass}>{dang ? 'Đang lưu...' : 'Lưu số điện thoại'}</button>
        </div>
      }
    >
      <form id="form-sdt" onSubmit={luu} className="flex flex-col gap-3">
        <label htmlFor="sdt-khach" className="text-sm font-medium">Số điện thoại</label>
        <input id="sdt-khach" inputMode="tel" autoComplete="off" autoFocus value={so} onChange={(e) => setSo(e.target.value)} placeholder="0912 345 678" className={inputClass} />
        <small className="text-xs text-muted">10 chữ số bắt đầu bằng 0, hoặc dạng +84. Sale nhập sau khi xin được số từ khách.</small>
        <ErrorText>{loi}</ErrorText>
      </form>
    </Modal>
  );
}
