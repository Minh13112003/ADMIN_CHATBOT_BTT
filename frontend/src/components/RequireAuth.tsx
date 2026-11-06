import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import useSWR from 'swr';
import { ApiError, fetcher } from '@/lib/api';
import type { Me } from '@/lib/types';

// Cookie đăng nhập là httpOnly nên JavaScript không đọc được: phải hỏi backend.
// Chỉ để chuyển trang cho dễ dùng, quyền thật do backend kiểm tra ở mọi API.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data, error } = useSWR<Me>('/auth/me', fetcher);

  if (error instanceof ApiError && error.status === 401) return <Navigate to="/login" replace />;
  if (data) return children;
  if (error) return <p className="p-6 text-sm text-brand-text">Không kết nối được máy chủ, bạn thử tải lại trang sau ít phút nhé.</p>;
  return <p className="p-6 text-sm text-muted">Đang tải...</p>;
}
