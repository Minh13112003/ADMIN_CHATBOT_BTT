import { playChime } from './notify';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import useSWR, { mutate } from 'swr';
import { API_URL, fetcher } from './api';
import type { Me } from './types';

/**
 * Thông báo hiện ở đầu trang.
 * CONTACT: khách đòi gặp nhân viên. BOOKING: khách tự đặt tour qua chatbot, cần gọi xác nhận.
 * SUPPORT / HANDOVER: đồng nghiệp nhắn hỗ trợ hoặc chuyển khách cho mình. FOLLOWUP: đến giờ hẹn mình đặt.
 */
export type Ping = { id: string; name: string; kind: 'CONTACT' | 'BOOKING' | 'SUPPORT' | 'HANDOVER' | 'FOLLOWUP'; channel?: string; assignee?: string | null; by?: string; note?: string | null };

type Ctx = {
  ping: Ping | null;
  clearPing: (id?: string) => void;
  sendTyping: (conversationId: string) => void;
  /** Tên đồng nghiệp đang soạn trong từng hội thoại (vài giây gần nhất). */
  typing: Record<string, string>;
  connected: boolean;
};

const RealtimeContext = createContext<Ctx>({ ping: null, clearPing: () => {}, sendTyping: () => {}, typing: {}, connected: false });
export const useRealtime = () => useContext(RealtimeContext);

/** Giao diện gửi "đang gõ" mỗi 5 giây, nên giữ dòng "đang soạn" 7 giây rồi tự tắt. */
const GIU_DANG_SOAN_MS = 7000;

const lamMoi = (id?: string) => {
  void mutate(
    (k) =>
      typeof k === 'string' &&
      (k.startsWith('/conversations?') || k === '/auth/me' || k.startsWith('/customers/') || (!!id && k === `/conversations/${id}`)),
  );
};

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [ping, setPing] = useState<Ping | null>(null);
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState<Record<string, string>>({});
  const socketRef = useRef<Socket | null>(null);
  const { data: me } = useSWR<Me>('/auth/me', fetcher);
  const meId = useRef<string | null>(null);
  meId.current = me?.id ?? null;
  const henTat = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const s = io(`${API_URL}/realtime`, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = s;
    s.on('connect', () => {
      setConnected(true);
      lamMoi();
    });
    s.on('disconnect', () => {
      setConnected(false);
      void mutate('/auth/me');
    });
    s.on('conversation:update', (p: { id: string }) => lamMoi(p.id));
    s.on('message:new', (p: { conversationId: string }) => {
      void mutate(`/conversations/${p.conversationId}/messages`);
      // Người vừa gửi thì không còn "đang soạn".
      setTyping((t) => {
        if (!(p.conversationId in t)) return t;
        const { [p.conversationId]: _, ...rest } = t;
        return rest;
      });
    });
    s.on('contact:new', (p: Omit<Ping, 'kind'> & { kind?: 'BOOKING' }) => {
      setPing({ ...p, kind: p.kind ?? 'CONTACT' });
      playChime();
      lamMoi(p.id);
    });
    s.on('support:new', (p: { id: string; toUserId: string; by: string; name: string; handover?: boolean }) => {
      if (p.toUserId === meId.current) {
        setPing({ id: p.id, name: p.name, by: p.by, kind: p.handover ? 'HANDOVER' : 'SUPPORT' });
        playChime();
      }
    });
    s.on('followup:due', (p: { id: string; toUserId: string | null; name: string; note: string | null }) => {
      if (p.toUserId === meId.current) {
        setPing({ id: p.id, name: p.name, note: p.note, kind: 'FOLLOWUP' });
        playChime();
      }
    });
    s.on('typing', (p: { conversationId: string; userId: string; name: string }) => {
      if (p.userId === meId.current) return;
      setTyping((t) => ({ ...t, [p.conversationId]: p.name }));
      clearTimeout(henTat.current[p.conversationId]);
      henTat.current[p.conversationId] = setTimeout(() => {
        setTyping((t) => {
          const { [p.conversationId]: _, ...rest } = t;
          return rest;
        });
      }, GIU_DANG_SOAN_MS);
    });
    const hen = henTat.current;
    return () => {
      Object.values(hen).forEach(clearTimeout);
      s.disconnect();
    };
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ping,
      connected,
      typing,
      clearPing: (id) => setPing((cur) => (!id || cur?.id === id ? null : cur)),
      sendTyping: (conversationId) => socketRef.current?.emit('typing', { conversationId }),
    }),
    [ping, connected, typing],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
