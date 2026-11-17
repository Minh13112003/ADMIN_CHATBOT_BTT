/**
 * @deprecated KHÔNG CÒN DÙNG (2026-11-17): không có route nào mở trang này; /performance chuyển thẳng sang /stats?view=sales trong App.tsx.
 * Giữ lại theo yêu cầu chủ dự án, chưa xoá. Không import file này vào chỗ mới.
 */
import StatsPage from './StatsPage';
export default function PerformancePage() { return <StatsPage forcedView="sales" />; }
