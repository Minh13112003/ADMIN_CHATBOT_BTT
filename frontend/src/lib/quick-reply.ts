export type QuickDeal = { tourName: string; tourCode: string | null; amount: number } | null | undefined;

export function prepareQuickReply(body: string, customerName: string, staffName: string, deal?: QuickDeal) {
  let out = body.replace(/{tên khách}/gi, customerName).replace(/{tên nhân viên}/gi, staffName);
  if (deal) {
    out = out
      .replace(/{tên tour}/gi, deal.tourName)
      .replace(/{giá tour}/gi, deal.amount.toLocaleString('vi-VN') + ' đ');
    if (deal.tourCode) out = out.replace(/{mã tour}/gi, deal.tourCode);
  }
  return out;
}

export function insertAtCursor(draft: string, insert: string, start: number, end: number) {
  return draft.slice(0, start) + insert + draft.slice(end);
}
