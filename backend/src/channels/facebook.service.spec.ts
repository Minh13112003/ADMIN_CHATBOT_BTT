import { FacebookService } from './facebook.service';

describe('FacebookService.hoSoKhach', () => {
  const tao = () => {
    const svc = new FacebookService({} as never, { get: () => '' } as never, {} as never);
    jest.spyOn(svc, 'doc').mockResolvedValue({ pageAccessToken: 'tok', appSecret: 'sec' });
    return svc;
  };
  const tra = (...cacLan: Array<Record<string, unknown>>) => {
    const f = jest.fn();
    for (const j of cacLan) f.mockResolvedValueOnce({ ok: !j.error, json: async () => j });
    global.fetch = f as never;
    return f;
  };
  const fieldsCuaLan = (f: jest.Mock, i: number) => new URL(f.mock.calls[i][0]).searchParams.get('fields');

  it('lấy được cả tên và ảnh ngay lần đầu', async () => {
    const f = tra({ name: 'Trần Thị Bình', profile_pic: 'https://fb/a.jpg' });
    expect(await tao().hoSoKhach('U1')).toEqual({ ten: 'Trần Thị Bình', anh: 'https://fb/a.jpg' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('Meta từ chối trường "name" thì thử lại với ít trường hơn, ghép họ + tên', async () => {
    const f = tra({ error: { code: 100, message: '(#100) Tried accessing nonexisting field (name)' } }, { first_name: 'Bình', last_name: 'Trần', profile_pic: 'https://fb/a.jpg' });
    expect(await tao().hoSoKhach('U1')).toEqual({ ten: 'Trần Bình', anh: 'https://fb/a.jpg' });
    expect(fieldsCuaLan(f, 1)).toBe('first_name,last_name,profile_pic');
  });

  it('không được tên thì vẫn lấy ảnh', async () => {
    tra(
      { error: { code: 100, message: 'Requires permission' } },
      { error: { code: 100, message: 'Requires permission' } },
      { profile_pic: 'https://fb/a.jpg' },
      { data: [] },
    );
    expect(await tao().hoSoKhach('U1')).toEqual({ ten: null, anh: 'https://fb/a.jpg' });
  });

  it('hồ sơ bị từ chối ("Unsupported get request") thì lấy tên từ danh sách cuộc trò chuyện của Trang', async () => {
    const f = tra(
      ...Array.from({ length: 4 }, () => ({ error: { code: 100, message: '(#100) Unsupported get request. Object with ID 1 does not exist, cannot be loaded due to missing permission' } })),
      { data: [{ participants: { data: [{ id: 'PAGE', name: 'BenThanh Tourist' }, { id: 'U1', name: 'Lam Nguyễn' }] } }] },
      { error: { code: 100, message: 'Unsupported get request' } },
    );
    expect(await tao().hoSoKhach('U1')).toEqual({ ten: 'Lam Nguyễn', anh: null });
    const u = new URL(f.mock.calls[4][0]);
    expect(u.pathname).toMatch(/\/me\/conversations$/);
    expect(u.searchParams.get('user_id')).toBe('U1');
  });

  it('hồ sơ bị từ chối nhưng đường /picture mở được thì lấy ảnh; ảnh mặc định (hình bóng) thì bỏ', async () => {
    const tu = (data: Record<string, unknown>) => [
      ...Array.from({ length: 4 }, () => ({ error: { code: 100, message: 'Unsupported get request' } })),
      { data: [{ participants: { data: [{ id: 'U1', name: 'Lam' }] } }] },
      { data },
    ];
    const f = tra(...tu({ url: 'https://scontent/a.jpg', is_silhouette: false }));
    expect(await tao().hoSoKhach('U1')).toEqual({ ten: 'Lam', anh: 'https://scontent/a.jpg' });
    expect(new URL(f.mock.calls[5][0]).pathname).toMatch(/\/U1\/picture$/);
    tra(...tu({ url: 'https://scontent/mac-dinh.jpg', is_silhouette: true }));
    expect(await tao().hoSoKhach('U1')).toEqual({ ten: 'Lam', anh: null });
  });

  it('bị từ chối hết thì trả rỗng, không ném lỗi, và nhớ lý do để trang Kênh kết nối hiện', async () => {
    tra(...Array.from({ length: 6 }, () => ({ error: { code: 200, message: 'Requires pages_read_engagement' } })));
    const svc = tao();
    expect(await svc.hoSoKhach('U1')).toEqual({ ten: null, anh: null });
    const t = await svc.trangThai();
    expect(t.loiHoSoGanNhat?.lyDo).toMatch(/pages_read_engagement/);
  });

  it('chỉ nhận ảnh https', async () => {
    tra({ name: 'An', profile_pic: 'http://khong-an-toan/a.jpg' });
    expect(await tao().hoSoKhach('U1')).toEqual({ ten: 'An', anh: null });
  });
});
