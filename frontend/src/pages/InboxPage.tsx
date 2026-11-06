import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ChatPane } from '@/components/inbox/ChatPane';
import { ConversationList } from '@/components/inbox/ConversationList';

export default function InboxPage() {
  const [params] = useSearchParams();
  const tuUrl = params.get('c');
  const [selected, setSelected] = useState<string | null>(tuUrl);

  useEffect(() => {
    if (tuUrl) setSelected(tuUrl);
  }, [tuUrl]);

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <div className={`min-h-0 min-w-0 flex-col md:flex md:w-[340px] md:flex-none md:shrink-0 ${selected ? 'hidden' : 'flex flex-1'}`}>
        <ConversationList selected={selected} onSelect={setSelected} />
      </div>
      <div className={`min-h-0 min-w-0 flex-1 ${selected ? 'flex' : 'hidden md:flex'}`}>
        {selected ? (
          <ChatPane key={selected} id={selected} onBack={() => setSelected(null)} />
        ) : (
          <p className="m-auto p-6 text-center text-sm text-muted">Chọn một hội thoại ở bên trái để xem nội dung.</p>
        )}
      </div>
    </div>
  );
}
