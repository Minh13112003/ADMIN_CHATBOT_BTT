import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { StorageService } from './storage.service';

const dich = (env: Record<string, string>) => new StorageService({ get: (k: string) => env[k] } as unknown as ConfigService);

describe('StorageService trên ổ đĩa', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'btt-st-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('có STORAGE_DIR thì coi là đã cấu hình, không cần Supabase', () => {
    expect(dich({ STORAGE_DIR: dir }).daCauHinh()).toBe(true);
    expect(dich({}).daCauHinh()).toBe(false);
  });

  it('ghi file rồi tìm lại được, không để lại file tạm', async () => {
    const s = dich({ STORAGE_DIR: dir });
    await s.upload('2026-11/abc.jpg', Buffer.from('noi dung'), 'image/jpeg');
    const tep = await s.tepODia('2026-11/abc.jpg');
    expect(tep).toEqual({ root: dir, rel: '2026-11/abc.jpg' });
    expect((await readFile(join(dir, '2026-11/abc.jpg'))).toString()).toBe('noi dung');
    expect(await readdir(join(dir, '2026-11'))).toEqual(['abc.jpg']);
  });

  it('không tìm thấy file chưa ghi, và từ chối đường dẫn thoát ra ngoài', async () => {
    const s = dich({ STORAGE_DIR: dir });
    expect(await s.tepODia('2026-11/khong-co.jpg')).toBeNull();
    expect(await s.tepODia('../etc/passwd')).toBeNull();
    await expect(s.upload('../x.jpg', Buffer.from('x'), 'image/jpeg')).rejects.toThrow();
  });
});
