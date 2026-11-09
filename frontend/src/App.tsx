import type { ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router';
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
import PerformancePage from '@/pages/PerformancePage';
import ChannelsPage from '@/pages/ChannelsPage';

/** Sale không thấy trang này. Chỉ để dễ dùng, quyền thật do backend kiểm tra. */
function AdminOnly({ children }: { children: ReactNode }) {
  const { data: me } = useSWR<Me>('/auth/me', fetcher);
  if (!me) return <p className="p-6 text-sm text-muted">Đang tải...</p>;
  return me.role === 'ADMIN' ? children : <Navigate to="/inbox" replace />;
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
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/deals" element={<DealsPage />} />
        <Route path="/reminders" element={<RemindersPage />} />
        <Route path="/templates" element={<ReplyLibraryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/stats" element={<AdminOnly><StatsPage /></AdminOnly>} />
        <Route path="/performance" element={<AdminOnly><PerformancePage /></AdminOnly>} />
        <Route path="/channels" element={<AdminOnly><ChannelsPage /></AdminOnly>} />
        <Route path="/accounts" element={<AdminOnly><AccountsPage /></AdminOnly>} />
      </Route>
      <Route path="*" element={<Navigate to="/inbox" replace />} />
    </Routes>
  );
}
