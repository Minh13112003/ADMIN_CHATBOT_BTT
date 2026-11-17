import { useState } from 'react';
import { linkTep } from '@/lib/api';

/** Ảnh đại diện nhân viên; chưa có ảnh (hoặc ảnh lỗi) thì hiện chữ cái đầu của tên. */
export function AnhNhanVien({ ten, anh, className }: { ten: string; anh?: string | null; className: string }) {
  const [loi, setLoi] = useState(false);
  const chu = ten.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? '?';
  if (anh && !loi) return <img src={linkTep(anh)} alt="" onError={() => setLoi(true)} className={`${className} object-cover`} />;
  return <span aria-hidden="true" className={`${className} grid place-items-center`}>{chu}</span>;
}
