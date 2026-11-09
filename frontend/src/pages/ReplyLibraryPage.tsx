import { useEffect, useState, type FormEvent } from "react";
import useSWR from "swr";
import {
  Dialog,
  ErrorText,
  Field,
  inputClass,
  primaryClass,
  Segmented,
  Switch,
} from "@/components/ui";
import QuickLibrary from "@/components/QuickLibrary";
import { del, fetcher, loiCua, patch, post } from "@/lib/api";
import { CHANNEL, RULE_TYPE } from "@/lib/labels";
import type { Rule, RuleType, Template } from "@/lib/types";

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d");
export default function ReplyLibraryPage() {
  const [tab, setTab] = useState<"quick" | "auto">("quick");
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-6 px-8 py-6 max-[1199px]:px-6 max-md:gap-5 max-md:px-4 max-md:py-5 [&_table_thead]:bg-fill [&_table_thead]:text-xs [&_table_th]:whitespace-nowrap [&_table_td]:py-[18px]">
      <header className="flex flex-wrap items-center justify-between gap-5 [&_.eyebrow]:hidden [&_h1]:hidden [&_p]:mt-0 [&_p]:max-w-[660px] [&_p]:text-sm [&_p]:leading-[1.65] [&_p]:text-muted">
        <div>
          <p className="eyebrow">CÔNG CỤ TƯ VẤN</p>
          <h1>Thư viện trả lời</h1>
          <p>Soạn mẫu dùng chung và quản lý các quy tắc tự động.</p>
        </div>
      </header>
      <div className="self-start">
        <Segmented
          label="Loại trả lời"
          value={tab}
          onChange={setTab}
          items={[
            { key: "quick", label: "Mẫu trả lời nhanh" },
            { key: "auto", label: "Quy tắc trả lời tự động" },
          ]}
        />
      </div>
      {tab === "quick" ? <QuickLibrary /> : <RuleLibrary />}
    </main>
  );
}

function RuleLibrary() {
  const { data, error, mutate } = useSWR<Rule[]>("/auto-replies", fetcher);
  const [editing, setEditing] = useState<Rule | "new" | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<RuleType>("KEYWORD");
  const [keywords, setKeywords] = useState("");
  const [body, setBody] = useState("");
  const [test, setTest] = useState("");
  const [testResult, setTestResult] = useState("");
  const [errorText, setErrorText] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const open = (rule: Rule | "new") => {
    setEditing(rule);
    setName(rule === "new" ? "" : rule.name);
    setType(rule === "new" ? "KEYWORD" : rule.type);
    setKeywords(rule === "new" ? "" : rule.keywords.join(", "));
    setBody(rule === "new" ? "" : rule.body);
    setErrorText("");
    setDeleteConfirm(false);
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorText("");
    try {
      const payload = {
        name,
        type,
        keywords:
          type === "KEYWORD"
            ? keywords
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
        body,
      };
      if (editing === "new") await post("/auto-replies", payload);
      else if (editing) await patch(`/auto-replies/${editing.id}`, payload);
      await mutate();
      setEditing(null);
    } catch (err) {
      setErrorText(loiCua(err));
    } finally {
      setBusy(false);
    }
  };
  const testRule = async () => {
    try {
      const result = await post<{ kind: string; name?: string; body?: string }>(
        "/auto-replies/test",
        { text: test },
      );
      setTestResult(
        result.kind === "CONTACT"
          ? "Khách yêu cầu gặp nhân viên."
          : result.kind === "RULE"
            ? `Khớp quy tắc ${result.name}: ${result.body}`
            : "Không khớp; bot sẽ trả lời.",
      );
    } catch (err) {
      setTestResult(loiCua(err));
    }
  };
  return (
    <>
      <p className="text-sm text-body">
        Ưu tiên: khách yêu cầu gặp nhân viên, quy tắc tự động, rồi đến bot. Quy
        tắc tạm dừng khi nhân viên đang nhắn.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Quy tắc trả lời tự động</h2>
        <button
          className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-brand-button bg-brand-button text-white"
          onClick={() => open("new")}
        >
          + Thêm quy tắc
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[650px] text-sm">
          <thead>
            <tr className="bg-fill text-left">
              <th className="p-3">Tên quy tắc</th>
              <th className="p-3">Loại</th>
              <th className="p-3">Nội dung trả lời</th>
              <th className="p-3">Áp dụng</th>
              <th className="p-3">Đã gửi</th>
              <th className="p-3">Bật</th>
              <th className="p-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.id} className="border-t border-line-soft">
                <td className="p-3 font-semibold">{r.name}</td>
                <td className="p-3">{RULE_TYPE[r.type]}</td>
                <td className="max-w-72 truncate p-3">{r.body}</td>
                <td className="p-3">
                  {r.channels
                    .filter((c) => CHANNEL[c].connected)
                    .map((c) => CHANNEL[c].short)
                    .join(", ")}
                </td>
                <td className="p-3">{r.sentCount}</td>
                <td className="p-3">
                  <Switch
                    label={`Bật ${r.name}`}
                    checked={r.enabled}
                    onChange={async (enabled) => {
                      await patch(`/auto-replies/${r.id}`, { enabled });
                      await mutate();
                    }}
                  />
                </td>
                <td className="p-3">
                  <button
                    className="text-brand-text underline"
                    onClick={() => open(r)}
                  >
                    Sửa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data && !error && (
          <p className="p-4 text-muted">Đang tải quy tắc...</p>
        )}
        {error && (
          <p className="p-4 text-brand-text">
            Không tải được quy tắc.{" "}
            <button onClick={() => void mutate()} className="underline">
              Thử lại
            </button>
          </p>
        )}
        {data?.length === 0 && (
          <p className="p-4 text-muted">Chưa có quy tắc nào.</p>
        )}
      </div>
      <div className="rounded-xl border border-line bg-surface p-4">
        <h3 className="font-semibold">Thử một câu của khách</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className={`${inputClass} flex-1`}
            value={test}
            onChange={(e) => setTest(e.target.value)}
            placeholder="Nhập câu khách có thể gửi"
          />
          <button
            className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface"
            disabled={!test.trim()}
            onClick={() => void testRule()}
          >
            Thử quy tắc
          </button>
        </div>
        {testResult && (
          <p role="status" className="mt-3 text-sm">
            {testResult}
          </p>
        )}
      </div>
      {editing && (
        <Dialog
          title={editing === "new" ? "Thêm quy tắc" : "Sửa quy tắc"}
          variant="drawer"
          onClose={() => setEditing(null)}
        >
          <form className="space-y-4" onSubmit={save}>
            <Field label="Tên quy tắc">
              <input
                required
                className={inputClass}
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Điều kiện">
              <select
                className={inputClass}
                value={type}
                onChange={(e) => setType(e.target.value as RuleType)}
              >
                {(Object.keys(RULE_TYPE) as RuleType[]).map((key) => (
                  <option key={key} value={key}>
                    {RULE_TYPE[key]}
                  </option>
                ))}
              </select>
            </Field>
            {type === "KEYWORD" && (
              <Field label="Từ khoá, cách nhau bằng dấu phẩy">
                <input
                  className={inputClass}
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </Field>
            )}
            <Field label="Nội dung trả lời">
              <textarea
                required
                className={inputClass}
                rows={7}
                maxLength={2000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>
            <ErrorText>{errorText}</ErrorText>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className={primaryClass}>
                Lưu quy tắc
              </button>
              {editing !== "new" && (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border px-3 text-[0.8125rem] font-semibold border-field bg-surface"
                  onClick={async () => {
                    if (!deleteConfirm) {
                      setDeleteConfirm(true);
                      return;
                    }
                    try {
                      await del(`/auto-replies/${editing.id}`);
                      await mutate();
                      setEditing(null);
                    } catch (err) {
                      setErrorText(loiCua(err));
                    }
                  }}
                >
                  {deleteConfirm ? "Bấm lần nữa để xoá" : "Xoá quy tắc"}
                </button>
              )}
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
