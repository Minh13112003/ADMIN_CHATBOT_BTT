export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  /** `code` do backend gửi kèm khi giao diện cần xử lý riêng, ví dụ OTHER_ACTIVE (đồng nghiệp đang nhắn). */
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      method: init?.method ?? 'GET',
      credentials: 'include',
      headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ, bạn thử lại sau ít phút nhé.');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) window.location.href = '/login';
    const m = data?.message;
    throw new ApiError(res.status, Array.isArray(m) ? m[0] : m || 'Có lỗi xảy ra, bạn thử lại nhé.', typeof data?.code === 'string' ? data.code : undefined);
  }
  return data as T;
}

/** Gửi file: để trình duyệt tự đặt Content-Type (có boundary), không tự ghi header. */
export async function postForm<T = unknown>(path: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, { method: 'POST', credentials: 'include', body: form });
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ, bạn thử lại sau ít phút nhé.');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401) window.location.href = '/login';
    const m = data?.message;
    throw new ApiError(res.status, res.status === 413 ? 'File quá lớn' : Array.isArray(m) ? m[0] : m || 'Có lỗi xảy ra, bạn thử lại nhé.', typeof data?.code === 'string' ? data.code : undefined);
  }
  return data as T;
}

/** Link file backend trả là đường dẫn tương đối (/files/...): thêm địa chỉ máy chủ. */
export const linkTep = (url: string) => `${API_URL}/api/v1${url}`;

export const post = <T = unknown>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
export const patch = <T = unknown>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });
export const del = (path: string) => api(path, { method: 'DELETE' });
export const fetcher = <T,>(path: string) => api<T>(path);

export const loiCua = (e: unknown) => (e instanceof Error ? e.message : 'Có lỗi xảy ra, bạn thử lại nhé.');
