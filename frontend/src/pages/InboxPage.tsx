import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import useSWR from 'swr';
import { ChatPane } from '@/components/inbox/ChatPane';
import { fetcher } from '@/lib/api';
import type { Me } from '@/lib/types';
import { ConversationList } from '@/components/inbox/ConversationList';

export default function InboxPage() {
  const [params, setParams] = useSearchParams();
  const { data: me } = useSWR<Me>('/auth/me', fetcher);
  const tuUrl = params.get('c');
  const [selected, setSelected] = useState<string | null>(tuUrl);

  useEffect(() => {
    setSelected(tuUrl);
  }, [tuUrl]);
  const selectConversation = (id: string | null) => {
    setSelected(id);
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set('c', id);
      else next.delete('c');
      return next;
    }, { replace: true });
  };

  // Digital chỉ xem một hội thoại được mở từ báo cáo nhu cầu tour, không có danh sách hộp thư.
  if (me?.role === 'DIGITAL' && selected) return <div className="flex h-full min-h-0"><ChatPane key={selected} id={selected} onBack={() => window.close()} /></div>;

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <div className={`min-h-0 min-w-0 flex-col lg:flex lg:w-[340px] lg:flex-none lg:shrink-0 ${selected ? 'hidden' : 'flex flex-1'}`}>
        <ConversationList selected={selected} onSelect={selectConversation} />
      </div>
      <div className={`min-h-0 min-w-0 flex-1 ${selected ? 'flex' : 'hidden lg:flex'}`}>
        {selected ? (
          <ChatPane key={selected} id={selected} onBack={() => selectConversation(null)} />
        ) : (
          <div className="m-auto max-w-sm p-8 text-center">
            <span className="inline-grid size-[88px] place-items-center rounded-[26px] border border-line bg-surface shadow-sm text-brand-text shadow-[0_10px_28px_#00000005]">
              <svg aria-hidden="true" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM7 8h10M7 12h6" />
              </svg>
            </span>
            <h2 className="mt-6 text-xl font-semibold">Bắt đầu một cuộc trò chuyện</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">Chọn khách hàng trong hộp thư để xem lịch sử, tư vấn và theo dõi hành trình đặt tour.</p>
          </div>
        )}
      </div>
    </div>
  );
}
