import { StickerLibrary } from '@/components/StickerLibrary';

export default function StickersPage() {
  return <main className="min-w-0 overflow-y-auto p-4 sm:p-6">
    <h1 className="text-xl font-bold">Kho sticker</h1>
    <p className="mb-6 mt-2 text-sm text-muted">Sticker dùng chung cho đội ngũ tư vấn. Khi gửi qua Zalo và Messenger, sticker được chuyển thành ảnh GIF để giữ chuyển động.</p>
    <StickerLibrary manage />
  </main>;
}
