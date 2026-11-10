import { useEffect, useState, type FormEvent } from 'react';
import useSWR from 'swr';
import { DeleteButton, ErrorText, inputClass, primaryClass, Segmented, Switch } from '@/components/ui';
import { del, fetcher, loiCua, patch, post } from '@/lib/api';
import { CHANNEL, RULE_TYPE } from '@/lib/labels';
import type { Rule, RuleType, Template } from '@/lib/types';

type Tab = 'auto' | 'quick';

export default function TemplatesPage() {
  const [tab, setTab] = useState<Tab>('auto');
  return (
    <section className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-6 px-8 py-6 max-[1199px]:px-6 max-md:gap-5 max-md:px-4 max-md:py-5 [&_table_thead]:bg-fill [&_table_thead]:text-xs [&_table_th]:whitespace-nowrap [&_table_td]:py-[18px] [&>div:not(.self-start)]:p-5">
      <header className="flex flex-wrap items-center justify-between gap-5 [&_.eyebrow]:hidden [&_h1]:hidden [&_p]:mt-0 [&_p]:max-w-[660px] [&_p]:text-sm [&_p]:leading-[1.65] [&_p]:text-muted">
        <div>
          <p className="eyebrow">CÔNG CỤ TƯ VẤN</p>
          <h1>Thư viện trả lời</h1>
          <p>Trả lời nhất quán, dành thêm thời gian cho khách hàng.</p>
        </div>
      </header>
      <div className="self-start">
        <Segmented
          label="Loại mẫu"
          value={tab}
          onChange={setTab}
          items={[
            { key: 'auto', label: 'Trả lời tự động' },
            { key: 'quick', label: 'Mẫu trả lời nhanh' },
          ]}
        />
      </div>
      {tab === 'auto' ? <AutoReplies /> : <QuickTemplates />}
    </section>
  );
}

function QuickTemplates() {
  const { data, error, mutate } = useSWR<Template[]>('/templates', fetcher);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loi, setLoi] = useState('');
  const [saving, setSaving] = useState(false);

  const them = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setLoi('');
    setSaving(true);
    try {
      await post('/templates', { title, body });
      setTitle('');
      setBody('');
      await mutate();
    } catch (err) {
      setLoi(loiCua(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <p className="text-sm text-body">Nhân viên bấm để chèn vào khung nhắn, sửa rồi mới gửi.</p>
      <details className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm [&>summary]:px-5 [&>summary]:py-4 [&>summary]:text-sm [&>summary]:font-semibold [&>summary]:text-brand-text [&>form]:rounded-none [&>form]:border-x-0 [&>form]:border-b-0 [&>form]:border-t [&>form]:border-line [&>form]:p-5">
        <summary>+ Thêm mới</summary>
        <form onSubmit={them} className="flex flex-wrap gap-2 rounded-[14px] border border-line bg-surface shadow-sm p-3">
          <input
            aria-label="Tên mẫu"
            placeholder="Tên mẫu"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`${inputClass} flex-[1_1_160px] !w-auto`}
          />
          <textarea
            rows={3}
            aria-label="Nội dung mẫu"
            placeholder="Nội dung tin nhắn"
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={`${inputClass} flex-[3_1_280px] !w-auto`}
          />
          <button type="submit" disabled={saving} className={primaryClass}>
            {saving ? 'Đang lưu…' : 'Thêm mẫu'}
          </button>
          <div className="w-full empty:hidden">{loi && <ErrorText>{loi}</ErrorText>}</div>
        </form>
      </details>
      <ErrorText>{loi}</ErrorText>
      {data?.map((q) => (
        <div key={q.id} className="flex items-start gap-3 rounded-[14px] border border-line bg-surface shadow-sm px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[0.9375rem] font-semibold">{q.title}</div>
            <div className="mt-1 text-sm leading-[1.45] text-body">{q.body}</div>
          </div>
          <DeleteButton
            label={`Xoá mẫu ${q.title}`}
            onConfirm={() =>
              void del(`/templates/${q.id}`)
                .then(() => mutate())
                .catch((err: unknown) => setLoi(loiCua(err)))
            }
          />
        </div>
      ))}
      {!data && !error && <p className="text-sm text-muted">Đang tải mẫu trả lời...</p>}
      {error && <ErrorText>Không tải được danh sách mẫu.</ErrorText>}
      {data?.length === 0 && <p className="text-sm text-muted">Chưa có mẫu nào.</p>}
    </>
  );
}

function AutoReplies() {
  const { data, error, mutate } = useSWR<Rule[]>('/auto-replies', fetcher);
  const [type, setType] = useState<RuleType>('KEYWORD');
  const [name, setName] = useState('');
  const [keys, setKeys] = useState('');
  const [body, setBody] = useState('');
  const [loi, setLoi] = useState('');
  const [saving, setSaving] = useState(false);

  const them = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setLoi('');
    const keywords = keys
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    if (type === 'KEYWORD' && !keywords.length) {
      setLoi('Nhập ít nhất một từ khoá');
      return;
    }
    setSaving(true);
    try {
      await post('/auto-replies', { name, type, keywords, body });
      setName('');
      setKeys('');
      setBody('');
      await mutate();
    } catch (err) {
      setLoi(loiCua(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <p className="text-sm text-body">
        Hệ thống tự gửi khi khớp điều kiện. Thứ tự ưu tiên: khách đòi gặp nhân viên, quy tắc tự động, rồi mới đến bot. Quy tắc tự dừng khi nhân viên đang nhắn.
      </p>
      <details className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm [&>summary]:px-5 [&>summary]:py-4 [&>summary]:text-sm [&>summary]:font-semibold [&>summary]:text-brand-text [&>form]:rounded-none [&>form]:border-x-0 [&>form]:border-b-0 [&>form]:border-t [&>form]:border-line [&>form]:p-5">
        <summary>+ Thêm mới</summary>
        <form onSubmit={them} className="flex flex-col gap-2 rounded-[14px] border border-line bg-surface shadow-sm p-3">
          <div className="text-[0.9375rem] font-semibold">Thêm quy tắc</div>
          <div role="group" aria-label="Điều kiện kích hoạt" className="flex flex-wrap gap-1.5">
            {(Object.keys(RULE_TYPE) as RuleType[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={`min-h-10 rounded-full border px-3 text-[0.8125rem] font-medium ${type === t ? 'border-ink bg-strong text-on-strong' : 'border-field bg-surface text-neutral-ink'}`}
              >
                {RULE_TYPE[t]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Tên quy tắc"
              placeholder="Tên quy tắc"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputClass} flex-[1_1_180px] !w-auto`}
            />
            {type === 'KEYWORD' && (
              <input
                aria-label="Từ khoá, cách nhau bằng dấu phẩy"
                placeholder="Từ khoá, cách nhau bằng dấu phẩy"
                value={keys}
                onChange={(e) => setKeys(e.target.value)}
                className={`${inputClass} flex-[2_1_240px] !w-auto`}
              />
            )}
          </div>
          <textarea
            aria-label="Nội dung trả lời tự động"
            rows={2}
            required
            placeholder="Nội dung tự gửi cho khách"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full resize-y rounded-[10px] border border-field px-3 py-2.5 text-sm"
          />
          <ErrorText>{loi}</ErrorText>
          <button type="submit" disabled={saving} className={`${primaryClass} self-start`}>
            {saving ? 'Đang lưu…' : 'Thêm quy tắc'}
          </button>
        </form>
      </details>

      <RuleTester />

      <ErrorText>{loi}</ErrorText>
      {data?.map((r) => (
        <div key={r.id} className="flex items-start gap-3 rounded-[14px] border border-line bg-surface shadow-sm px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[0.9375rem] font-semibold">{r.name}</span>
              <span className="rounded-[10px] bg-auto px-2 py-0.5 text-xs font-medium text-auto-ink">{RULE_TYPE[r.type]}</span>
            </div>
            {!!r.keywords.length && <div className="mt-1 text-[0.8125rem] text-muted">Từ khoá: {r.keywords.join(', ')}</div>}
            <div className="mt-1 text-sm leading-[1.45] text-body">{r.body}</div>
            <div className="mt-1.5 text-xs text-muted">
              Áp dụng:{' '}
              {r.channels
                .filter((c) => CHANNEL[c].connected)
                .map((c) => CHANNEL[c].label)
                .join(', ')}{' '}
              · Đã gửi {r.sentCount} lần
            </div>
          </div>
          <DeleteButton
            label={`Xoá quy tắc ${r.name}`}
            onConfirm={() =>
              void del(`/auto-replies/${r.id}`)
                .then(() => mutate())
                .catch((err: unknown) => setLoi(loiCua(err)))
            }
          />
          <Switch
            checked={r.enabled}
            label={`Bật quy tắc ${r.name}`}
            onChange={(v) =>
              void patch(`/auto-replies/${r.id}`, { enabled: v })
                .then(() => mutate())
                .catch((err: unknown) => setLoi(loiCua(err)))
            }
          />
        </div>
      ))}
      {!data && !error && <p className="text-sm text-muted">Đang tải quy tắc...</p>}
      {error && <ErrorText>Không tải được quy tắc.</ErrorText>}
      {data?.length === 0 && <p className="text-sm text-muted">Chưa có quy tắc nào.</p>}
    </>
  );
}

function RuleTester() {
  const [text, setText] = useState('');
  const [kq, setKq] = useState('');

  useEffect(() => {
    const t = text.trim();
    if (!t) {
      setKq('');
      return;
    }
    const h = setTimeout(async () => {
      try {
        const r = await post<{ kind: string; name?: string; body?: string }>('/auto-replies/test', { text: t });
        setKq(
          r.kind === 'CONTACT'
            ? 'Chuyển sang Liên hệ, báo nhân viên. Không dùng quy tắc tự động.'
            : r.kind === 'RULE'
              ? `Khớp quy tắc "${r.name}": ${r.body}`
              : 'Không khớp quy tắc từ khoá nào. Bot sẽ tự trả lời.',
        );
      } catch (e) {
        setKq(loiCua(e));
      }
    }, 300);
    return () => clearTimeout(h);
  }, [text]);

  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-line bg-surface shadow-sm p-3">
      <label htmlFor="thu-quy-tac" className="text-[0.9375rem] font-semibold">
        Thử một câu của khách
      </label>
      <input
        id="thu-quy-tac"
        placeholder="Ví dụ: cho mình xin giá đoàn 20 người"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={inputClass}
      />
      {kq && (
        <div role="status" className="rounded-[10px] bg-fill px-2.5 py-2 text-sm">
          {kq}
        </div>
      )}
    </div>
  );
}
