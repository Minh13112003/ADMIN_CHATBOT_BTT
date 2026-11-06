import { Link } from 'react-router';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { inputClass } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { CHANNEL, dinhDangSo, STATUS } from '@/lib/labels';
import type { CustomerRow } from '@/lib/types';

const COT = ['Họ tên', 'Số điện thoại', 'Nguồn', 'Quan tâm', 'Trạng thái', 'Phụ trách'];

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [tu, setTu] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setTu(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, error, isLoading } = useSWR<CustomerRow[]>(`/customers${tu ? `?search=${encodeURIComponent(tu)}` : ''}`, fetcher, { keepPreviousData: true });

  const dong = (data ?? []).flatMap((k) => k.conversations.map((c) => ({ k, c })));

  return (
    <section className="flex flex-col gap-3 p-4 sm:p-[18px]">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex-1 whitespace-nowrap text-lg font-semibold">Khách hàng</h2>
        <input aria-label="Tìm theo tên hoặc số điện thoại" placeholder="Tìm tên hoặc số điện thoại" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} sm:max-w-72`} />
      </div>
      {/* relative: giữ nhãn sr-only (định vị tuyệt đối) trong khung cuộn, nếu không nó làm cả trang tràn ngang. */}
      <div className="relative overflow-x-auto rounded-[14px] border border-line bg-surface">
        {/* Màn hình nhỏ dùng thẻ để thấy đủ thông tin mà không phải vuốt ngang; từ lg (đủ chỗ cho bảng 820px) dùng bảng. */}
        <ul className="divide-y divide-line-soft lg:hidden">
          {dong.map(({ k, c }) => (
            <li key={c.id} className="flex flex-col gap-2.5 p-3.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="break-words text-sm font-semibold">{k.name}</div>
                  <div className="text-[0.8125rem] text-muted">{dinhDangSo(k.phone)}</div>
                </div>
                <span className={`shrink-0 whitespace-nowrap rounded-[10px] px-2.5 py-[3px] text-xs font-semibold ${STATUS[c.status].className}`}>{STATUS[c.status].label}</span>
              </div>
              <dl className="grid grid-cols-[80px_minmax(0,1fr)] gap-x-2 gap-y-1 text-[0.8125rem]">
                <dt className="text-muted">Nguồn</dt>
                <dd>{CHANNEL[c.channel].label}</dd>
                <dt className="text-muted">Quan tâm</dt>
                <dd className="break-words">{c.interest ?? 'Chưa rõ'}</dd>
                <dt className="text-muted">Phụ trách</dt>
                <dd className="break-words">{c.assignee?.fullName ?? 'Chưa có'}</dd>
              </dl>
              <Link to={`/inbox?c=${c.id}`} className="flex min-h-11 items-center justify-center rounded-[10px] border border-field text-[0.8125rem] hover:bg-fill">
                Mở hội thoại
              </Link>
            </li>
          ))}
        </ul>
        <table className="hidden w-full min-w-[820px] border-collapse text-sm lg:table">
          <thead>
            <tr className="text-left text-body">
              {COT.map((h) => (
                <th key={h} scope="col" className="border-b border-line px-3.5 py-3 font-semibold">
                  {h}
                </th>
              ))}
              <th scope="col" className="border-b border-line px-3.5 py-3">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {dong.map(({ k, c }) => (
              <tr key={c.id} className="hover:bg-page">
                <td className="border-b border-line-soft px-3.5 py-2.5 font-medium">{k.name}</td>
                <td className="border-b border-line-soft px-3.5 py-2.5">{dinhDangSo(k.phone)}</td>
                <td className="border-b border-line-soft px-3.5 py-2.5">{CHANNEL[c.channel].label}</td>
                <td className="border-b border-line-soft px-3.5 py-2.5">{c.interest ?? 'Chưa rõ'}</td>
                <td className="border-b border-line-soft px-3.5 py-2.5">
                  <span className={`rounded-[10px] px-2.5 py-[3px] text-xs font-semibold ${STATUS[c.status].className}`}>{STATUS[c.status].label}</span>
                </td>
                <td className="border-b border-line-soft px-3.5 py-2.5">{c.assignee?.fullName ?? 'Chưa có'}</td>
                <td className="border-b border-line-soft px-3.5 py-1.5 text-right">
                  <Link to={`/inbox?c=${c.id}`} className="inline-flex min-h-10 items-center rounded-[10px] border border-field px-3 text-[0.8125rem] hover:bg-fill">
                    Mở hội thoại
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && !data && <p className="p-6 text-center text-sm text-muted">Đang tải...</p>}
        {error && <p className="p-6 text-center text-sm text-brand-text">Không tải được danh sách khách.</p>}
        {data && dong.length === 0 && <p className="p-6 text-center text-sm text-muted">Chưa có khách nào.</p>}
      </div>
    </section>
  );
}
