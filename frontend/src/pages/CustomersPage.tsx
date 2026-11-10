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
  const [channel, setChannel] = useState<'ALL' | 'WEB' | 'APP'>('ALL');
  const [urgent, setUrgent] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTu(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, error, isLoading } = useSWR<CustomerRow[]>(`/customers${tu ? `?search=${encodeURIComponent(tu)}` : ''}`, fetcher, { keepPreviousData: true });

  const allRows = (data ?? []).flatMap((k) => k.conversations.map((c) => ({ k, c })));
  const dong = allRows.filter(({ c }) => (channel === 'ALL' || c.channel === channel) && (!urgent || c.status === 'CONTACT' || c.status === 'UNREAD'));
  const needsHelp = allRows.filter(({ c }) => c.status === 'CONTACT' || c.status === 'UNREAD').length;

  return (
    <section className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-6 px-8 py-6 max-[1199px]:px-6 max-md:gap-5 max-md:px-4 max-md:py-5 [&_table_thead]:bg-fill [&_table_thead]:text-xs [&_table_th]:whitespace-nowrap [&_table_td]:py-[18px]">
      <div className="flex flex-wrap items-center gap-3">
        <header className="flex flex-wrap items-center justify-between gap-5 [&_.eyebrow]:hidden [&_h1]:hidden [&_p]:mt-0 [&_p]:max-w-[660px] [&_p]:text-sm [&_p]:leading-[1.65] [&_p]:text-muted flex-1">
          <div>
            <p className="eyebrow">KẾT NỐI & CHĂM SÓC</p>
            <h1>Khách hàng</h1>
            <p>Thông tin và lịch sử tư vấn tại một nơi.</p>
          </div>
        </header>
        <input
          aria-label="Tìm theo tên hoặc số điện thoại"
          placeholder="Tìm tên hoặc số điện thoại"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} sm:max-w-72`}
        />
      </div>
      <div className="grid grid-cols-4 gap-3.5 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1 [&>div]:flex [&>div]:min-h-[130px] [&>div]:flex-col [&>div]:gap-2 [&>div]:rounded-[13px] [&>div]:border [&>div]:border-line [&>div]:bg-surface [&>div]:shadow-sm [&>div]:p-[18px] [&_span]:text-[0.82rem] [&_span]:text-muted [&_strong]:text-[1.8rem] [&_strong]:leading-[1.1] [&_small]:text-xs [&_small]:text-muted [&_.attention]:border-alert-line [&_.attention_strong]:text-brand-text">
        <div><span>Khách hàng tìm thấy</span><strong>{(data ?? []).length.toLocaleString('vi-VN')}</strong><small>Trong danh sách đang tìm kiếm</small></div>
        <div><span>Hội thoại</span><strong>{allRows.length.toLocaleString('vi-VN')}</strong><small>Trên Web và ứng dụng</small></div>
        <div className="attention"><span>Cần tư vấn</span><strong>{needsHelp.toLocaleString('vi-VN')}</strong><small>Liên hệ hoặc chưa xem</small></div>
        <div><span>Hội thoại đã chốt</span><strong>{allRows.filter(({ c }) => c.status === 'CLOSED').length.toLocaleString('vi-VN')}</strong><small>Đã hoàn tất tư vấn</small></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface shadow-sm p-3.5 [&>span:first-child]:mr-1 [&>span:first-child]:text-[0.8rem] [&>span:first-child]:text-muted [&_button]:min-h-9 [&_button]:rounded-[20px] [&_button]:bg-fill [&_button]:px-[13px] [&_button]:text-[0.78rem] [&_button[aria-pressed=true]]:bg-brand-soft [&_button[aria-pressed=true]]:font-bold [&_button[aria-pressed=true]]:text-brand-text" role="group" aria-label="Lọc khách hàng">
        <span>Bộ lọc nhanh</span>
        {([{ key: 'ALL', label: 'Tất cả nguồn' }, { key: 'WEB', label: 'bttAI Web' }, { key: 'APP', label: 'bttAI App' }] as const).map((item) => <button key={item.key} type="button" aria-pressed={channel === item.key} onClick={() => setChannel(item.key)}>{item.label}</button>)}
        <button type="button" aria-pressed={urgent} onClick={() => setUrgent(!urgent)}>Cần hỗ trợ ngay ({needsHelp})</button>
        <span className="ml-auto text-[0.78rem] text-muted">{dong.length} hội thoại</span>
      </div>
      {/* relative: giữ nhãn sr-only (định vị tuyệt đối) trong khung cuộn, nếu không nó làm cả trang tràn ngang. */}
      <div className="relative overflow-x-auto rounded-[14px] border border-line bg-surface shadow-sm">
        {/* Màn hình nhỏ dùng thẻ để thấy đủ thông tin mà không phải vuốt ngang; từ lg (đủ chỗ cho bảng 820px) dùng bảng. */}
        <ul className="divide-y divide-line-soft xl:hidden">
          {dong.map(({ k, c }) => (
            <li key={c.id} className="flex flex-col gap-2.5 p-3.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="break-words text-sm font-semibold">{k.name}</div>
                  <div className="text-[0.8125rem] text-muted">{dinhDangSo(k.phone)}</div>
                </div>
                <span className={`shrink-0 whitespace-nowrap rounded-[10px] px-2.5 py-[3px] text-xs font-semibold ${STATUS[c.status].className}`}>
                  {STATUS[c.status].label}
                </span>
              </div>
              <dl className="grid grid-cols-[80px_minmax(0,1fr)] gap-x-2 gap-y-1 text-[0.8125rem]">
                <dt className="text-muted">Nguồn</dt>
                <dd>{CHANNEL[c.channel].label}</dd>
                <dt className="text-muted">Quan tâm</dt>
                <dd className="break-words">{c.interest ?? 'Chưa rõ'}</dd>
                <dt className="text-muted">Phụ trách</dt>
                <dd className="break-words">{c.assignee?.fullName ?? 'Chưa có'}</dd>
              </dl>
              <Link
                to={`/inbox?c=${c.id}`}
                className="flex min-h-11 items-center justify-center rounded-[10px] border border-field text-[0.8125rem] hover:bg-fill"
              >
                Mở hội thoại
              </Link>
            </li>
          ))}
        </ul>
        <table className="hidden w-full min-w-[820px] border-collapse text-sm xl:table">
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
                  <Link
                    to={`/inbox?c=${c.id}`}
                    className="inline-flex min-h-10 items-center rounded-[10px] border border-field px-3 text-[0.8125rem] hover:bg-fill"
                  >
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
