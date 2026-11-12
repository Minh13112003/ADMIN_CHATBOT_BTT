import type { ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useSearchParams } from 'react-router';
import useSWR from 'swr';
import { RequireAuth } from '@/components/RequireAuth';
import { Shell } from '@/components/Shell';
import { fetcher } from '@/lib/api';
import { RealtimeProvider } from '@/lib/realtime';
import type { Me } from '@/lib/types';
import AccountsPage from '@/pages/AccountsPage';
import CustomersPage from '@/pages/CustomersPage';
import InboxPage from '@/pages/InboxPage';
import LoginPage from '@/pages/LoginPage';
import StatsPage from '@/pages/StatsPage';
import SettingsPage from '@/pages/SettingsPage';
import ReplyLibraryPage from '@/pages/ReplyLibraryPage';
import DealsPage from '@/pages/DealsPage';
import RemindersPage from '@/pages/RemindersPage';
import ChannelsPage from '@/pages/ChannelsPage';
import TourInterestPage from '@/pages/TourInterestPage';
import VouchersPage from '@/pages/VouchersPage';

/** Sale không thấy trang này. Chỉ để dễ dùng, quyền thật do backend kiểm tra. */
function AdminOnly({ children }: { children: ReactNode }) {
  const { data: me } = useSWR<Me>('/auth/me', fetcher);
  if (!me) return <p className="p-6 text-sm text-muted">Đang tải...</p>;
  return me.role === 'ADMIN' ? children : <Navigate to="/inbox" replace />;
}

/** Admin toàn quyền và admin phòng (thống kê, tài khoản trong phạm vi phòng). */
function AdminOrDept({ children }: { children: ReactNode }) {
  const { data: me } = useSWR<Me>('/auth/me', fetcher);
  if (!me) return <p className="p-6 text-sm text-muted">Đang tải...</p>;
  return me.role === 'ADMIN' || me.role === 'DEPT_ADMIN' ? children : <Navigate to="/inbox" replace />;
}

/** Digital chỉ có trang Nhu cầu tour (và xem tin nhắn gốc), không dùng các trang còn lại. */
function NotDigital({ children }: { children: ReactNode }) {
  const { data: me } = useSWR<Me>('/auth/me', fetcher);
  if (!me) return <p className="p-6 text-sm text-muted">Đang tải...</p>;
  return me.role === 'DIGITAL' ? <Navigate to="/tour-interest" replace /> : children;
}

/** Digital chỉ vào hộp thư khi mở một tin nhắn gốc từ báo cáo (có ?c=). */
function InboxGate({ children }: { children: ReactNode }) {
  const { data: me } = useSWR<Me>('/auth/me', fetcher);
  const [params] = useSearchParams();
  if (!me) return <p className="p-6 text-sm text-muted">Đang tải...</p>;
  return me.role === 'DIGITAL' && !params.get('c') ? <Navigate to="/tour-interest" replace /> : children;
}

function WorkspaceLayout() {
  return (
    <RequireAuth>
      <RealtimeProvider>
        <Shell>
          <Outlet />
        </Shell>
      </RealtimeProvider>
    </RequireAuth>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<WorkspaceLayout />}>
        <Route path="/inbox" element={<InboxGate><InboxPage /></InboxGate>} />
        <Route path="/customers" element={<NotDigital><CustomersPage /></NotDigital>} />
        <Route path="/deals" element={<NotDigital><DealsPage /></NotDigital>} />
        <Route path="/reminders" element={<NotDigital><RemindersPage /></NotDigital>} />
        <Route path="/templates" element={<NotDigital><ReplyLibraryPage /></NotDigital>} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/tour-interest" element={<TourInterestPage />} />
        <Route path="/stats" element={<AdminOrDept><StatsPage /></AdminOrDept>} />
        <Route path="/performance" element={<Navigate to="/stats?view=sales" replace />} />
        <Route path="/channels" element={<AdminOnly><ChannelsPage /></AdminOnly>} />
        <Route path="/accounts" element={<AdminOrDept><AccountsPage /></AdminOrDept>} />
        <Route path="/vouchers" element={<AdminOrDept><VouchersPage /></AdminOrDept>} />
      </Route>
      <Route path="*" element={<Navigate to="/inbox" replace />} />
    </Routes>
  );
}
