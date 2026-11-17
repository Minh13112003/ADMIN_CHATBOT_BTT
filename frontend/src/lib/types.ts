export type Status = 'CONTACT' | 'UNREAD' | 'READ' | 'PENDING' | 'CLOSED';
export type Channel = 'WEB' | 'APP' | 'ZALO' | 'FACEBOOK';
/** OWNER: mình phụ trách. SUPPORT: người khác phụ trách, mình nhắn là hỗ trợ. UNASSIGNED: chưa ai, trả lời là nhận. */
export type Role = 'OWNER' | 'SUPPORT' | 'UNASSIGNED';
export type RuleType = 'FIRST_MESSAGE' | 'KEYWORD' | 'OFF_HOURS';

/** ADMIN toàn quyền · DEPT_ADMIN admin phòng ban · DIGITAL chỉ xem nhu cầu tour · SALE tư vấn. */
export type UserRole = 'ADMIN' | 'SALE' | 'DEPT_ADMIN' | 'DIGITAL';
export type Department = { id: string; name: string; members: number };

export type Me = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  employeeCode: string | null;
  position: string | null;
  onDuty: boolean;
  load: number;
  departmentId?: string | null;
  department?: { name: string } | null;
  scopeIds?: string[];
  /** Đường dẫn ảnh đại diện (tương đối, ghép bằng linkTep), null = chưa có ảnh. */
  avatarUrl?: string | null;
};

export type Person = { id: string; fullName: string };

export type Conversation = {
  id: string;
  channel: Channel;
  status: Status;
  mode: 'BOT' | 'STAFF';
  customer: { id: string; name: string; aliases: string[]; phone: string | null; phoneVerified: boolean; avatarUrl?: string | null };
  assignee: Person | null;
  role: Role;
  /** Đồng nghiệp đang soạn hoặc vừa gửi trong 1 phút: bấm gửi sẽ được hỏi lại. */
  activeOther: Person | null;
  autoReplyOn: boolean;
  interest: string | null;
  tags: string[];
  note: string | null;
  followUp: { at: string; note: string | null; by: Person | null } | null;
  /** Lần cuối khung chat phía khách mở và lấy tin nhân viên. */
  customerSeenAt: string | null;
  /** Lần cuối khách nhắn (khung 48 giờ của Zalo tính từ đây). */
  lastCustomerMessageAt?: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  /** Ai gửi tin (không phải log nội bộ) mới nhất; chỉ có trong danh sách hội thoại. */
  lastMessageFrom?: { type: 'CUSTOMER' | 'STAFF' | 'BOT' | 'AUTO' | 'SYSTEM'; staffLabel: string | null; staffId: string | null } | null;
};

export type ConversationList = { items: Conversation[]; counts: Partial<Record<Status, number>>; hasMore: boolean };

export type TourCard = Record<string, unknown>;

export type Attachment = { url: string; type: string; name: string; size: number };

export type Message = {
  id: string;
  senderType: 'CUSTOMER' | 'BOT' | 'AUTO' | 'STAFF' | 'SYSTEM';
  staffLabel: string | null;
  ruleName: string | null;
  text: string;
  internal: boolean;
  isTrigger: boolean;
  tours: TourCard[] | null;
  replyTo: { id: string; text: string; senderType: Message['senderType'] } | null;
  attachment: Attachment | null;
  createdAt: string;
};

export type DealStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export type Deal = {
  id: string;
  conversationId: string;
  channel: Channel;
  status: DealStatus;
  source: 'CHATBOT' | 'STAFF' | 'APP';
  pointsAwarded?: number | null;
  orderCode: string | null;
  tourCode: string | null;
  tourName: string;
  guests: number;
  /** Người lớn, trẻ em, em bé (đơn đặt trong app, hoặc sale nhập khi chốt từ 2026-11-16). */
  adults?: number | null;
  children?: number | null;
  infants?: number | null;
  amount: number;
  bookingStatus: string | null;
  createdAt: string;
  closedAt: string;
  voidedAt: string | null;
  closedBy: { fullName: string } | null;
  unitPrice?: number | null;
  subtotal?: number | null;
  discount?: number | null;
  voucherCode?: string | null;
  departureDate?: string | null;
};

export type MessageHit = { id: string; conversationId: string; senderType: Message['senderType']; text: string; internal: boolean; createdAt: string; channel: Channel; name: string; phone: string | null };

export type Template = { id: string; title: string; body: string; shortcut?: string | null; category?: string | null; useCount?: number };

export type Rule = {
  id: string;
  name: string;
  type: RuleType;
  keywords: string[];
  body: string;
  channels: Channel[];
  enabled: boolean;
  sentCount: number;
};

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  conversations: { id: string; channel: Channel; status: Status; interest: string | null; lastMessageAt: string; assignee: { fullName: string } | null }[];
};

export type Stats = {
  updatedAt: string;
  closeRate: number | null;
  conversion?: { respondedCustomers: number; closedCustomers: number };
  cancelled: { count: number; tours: { name: string; count: number; amount: number }[] };
  /** Chỉ admin toàn quyền (không lọc phòng) mới có. */
  departments: { id: string | null; name: string; deals: number; revenue: number; guests: number }[];
  customers: number;
  phones: number;
  contact: number;
  closed: number;
  guests: number;
  revenue: Record<Channel, number>;
  totalRevenue: number;
  tours: { name: string; orders: number; guests: number; revenue: number }[];
  staff: { id: string; departmentName: string; name: string; contact: number; closed: number; closedCustomers?: number; guests?: number; revenue: number; responses: number; avgSeconds: number | null; medianSeconds: number | null; within5MinRate: number | null; onDuty: boolean; load: number; isSale: boolean }[];
  pending: { count: number; amount: number };
  responseTime: { count: number; avgSeconds: number | null; medianSeconds: number | null; within5MinRate: number | null };
  topCustomers: { id: string; name: string; phone: string | null; orders: number; guests: number; revenue: number; lastClosedAt: string; channels: { channel: Channel; revenue: number }[] }[];
  gemini: { inputTokens: number; outputTokens: number; inputUsd: number; outputUsd: number; usd: number; vnd: number; usdVndRate: number; priceInput: number; priceOutput: number };
};

export type StatsSeriesPoint = { start: string; label: string; customers: number; contacts: number; deals: number; revenue: number; costVnd: number };
export type CostSource = { source: 'AI' | 'ZALO' | 'FACEBOOK'; costVnd: number; share: number; connected: boolean };

export type Account = {
  id: string;
  email: string;
  fullName: string;
  employeeCode: string | null;
  position: string | null;
  role: UserRole;
  departmentId?: string | null;
  department?: { name: string } | null;
  scopeIds?: string[];
  isActive: boolean;
  lastLoginAt: string | null;
  holding?: number;
};

/** Tour trong danh mục benthanhtourist.com (backend lưu tạm 1 giờ). Giá, mã, ngày là của đợt gần nhất. */
export type CatalogTour = {
  key: string;
  code: string | null;
  name: string;
  image: string | null;
  days: number | null;
  nights: number | null;
  price: number | null;
  departureDate: string | null;
  categoryIds: number[];
  place: { id: number; name: string } | null;
  matchedDay?: TourDay;
};
export type TourDay = { id: string; code: string; departureDate: string; returnDate: string | null; price: number; stock: number | null; available: boolean };
export type TourDetail = CatalogTour & { tourDays: TourDay[] };
export type Place = { id: number; name: string; tours: number };

export type Quote = {
  tourKey: string | null;
  tourName: string;
  place: string | null;
  image: string | null;
  dayCode: string;
  departureDate: string | null;
  unitPrice: number;
  guests: number;
  adults: number;
  children: number;
  infants: number;
  childPrice: number;
  infantPrice: number;
  subtotal: number;
  voucher: { id: string; code: string; label: string } | null;
  voucherError: string | null;
  discount: number;
  total: number;
  priceFromDeal: boolean;
};

export type TourTag = {
  id: string;
  tourKey: string;
  tourName: string;
  categoryName: string | null;
  createdAt: string;
  createdBy: { fullName: string } | null;
  /** Lần thứ mấy tour này được gắn trong hội thoại. */
  time: number;
  message: { id: string; text: string; senderType: Message['senderType']; staffLabel: string | null; createdAt: string };
};

export type VoucherStatus = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'PAUSED' | 'USED_UP';
export type Voucher = {
  id: string;
  code: string;
  type: 'AMOUNT' | 'PERCENT';
  value: number;
  maxDiscount: number | null;
  scope: 'TOUR' | 'CATEGORY' | 'ALL';
  tourKey: string | null;
  tourName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  startsAt: string;
  endsAt: string;
  maxUses: number | null;
  /** Chỉ khách đúng hạng này dùng được (mã DONG...RUBY). */
  tier: string | null;
  maxUsesPerCustomerMonth: number | null;
  used: number;
  note: string | null;
  isActive: boolean;
  label: string;
  status: VoucherStatus;
};
export type VoucherList = { summary: { active: number; usedThisMonth: number; expiringSoon: number }; items: Voucher[] };

/** GET /stats/board: số cho trang Thống kê mới (5 tab). Chuỗi theo mốc cùng độ dài với `buckets`. */
type Kenh4 = Record<Channel, number>;
type Hist = { labels: string[]; counts: number[] };
export type StatsBoardRange = '7d' | '30d' | 'quarter';
export type StatsBoard = {
  range: StatsBoardRange;
  granularity: 'day' | 'week';
  updatedAt: string;
  buckets: { start: string; end: string; label: string }[];
  customers: {
    total: number; newCustomers: number; phones: number; contacts: number; interested: number; converted: number;
    byChannelSeries: Record<Channel, number[]>; byChannelTotal: Kenh4; newSeries: number[]; returningSeries: number[];
    contactHeatmap: number[][]; places: { place: string; asks: number; customers: number }[]; totalAsks: number;
  };
  tours: {
    interestedTours: number;
    rows: { key: string; name: string; place: string | null; interested: number; orders: number; guests: number; revenue: number }[];
    byPlace: { place: string; interested: number; orders: number }[];
    guestsPerDeal: Hist;
    upcoming: { week: string; guests: number }[];
  };
  revenue: {
    total: number; prevTotal: number; deals: number; guests: number; gross: number; discount: number;
    series: number[]; prevSeries: number[]; dealSeries: number[]; guestSeries: number[]; byChannel: Kenh4;
    byDepartment: { name: string; series: number[]; total: number }[];
    valueHistogram: Hist;
    pending: { count: number; amount: number }; cancelled: { count: number; amount: number };
    topCustomers: { id: string; name: string; phone: string | null; orders: number; guests: number; revenue: number; channels: Channel[] }[];
  };
  sales: {
    rows: { id: string; name: string; employeeCode: string | null; position: string | null; departmentName: string | null; onDuty: boolean; isActive: boolean; conversations: number; responses: number; medianSeconds: number | null; within5MinRate: number | null; deals: number; guests: number; revenue: number; closeRate: number | null; medianSeries: (number | null)[] }[];
    responses: number; medianSeconds: number | null; within5MinRate: number | null; responseHistogram: Hist; medianSeries: (number | null)[];
  };
  channels: {
    conversationsSeries: Record<Channel, number[]>; botSeries: number[]; staffSeries: number[]; botConversations: number; staffConversations: number;
    cost: number; tokens: number; costSeries: number[]; tokenSeries: number[]; costByChannel: Kenh4 & { OTHER: number };
  };
};
