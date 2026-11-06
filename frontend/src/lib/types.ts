export type Status = 'CONTACT' | 'UNREAD' | 'READ' | 'PENDING' | 'CLOSED';
export type Channel = 'WEB' | 'APP' | 'ZALO' | 'FACEBOOK';
/** OWNER: mình phụ trách. SUPPORT: người khác phụ trách, mình nhắn là hỗ trợ. UNASSIGNED: chưa ai, trả lời là nhận. */
export type Role = 'OWNER' | 'SUPPORT' | 'UNASSIGNED';
export type RuleType = 'FIRST_MESSAGE' | 'KEYWORD' | 'OFF_HOURS';

export type Me = {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'SALE';
  employeeCode: string | null;
  position: string | null;
  onDuty: boolean;
  load: number;
};

export type Person = { id: string; fullName: string };

export type Conversation = {
  id: string;
  channel: Channel;
  status: Status;
  mode: 'BOT' | 'STAFF';
  customer: { id: string; name: string; aliases: string[]; phone: string | null; phoneVerified: boolean };
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
  lastMessageAt: string;
  lastMessagePreview: string | null;
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
  source: 'CHATBOT' | 'STAFF';
  orderCode: string | null;
  tourCode: string | null;
  tourName: string;
  guests: number;
  amount: number;
  bookingStatus: string | null;
  createdAt: string;
  closedAt: string;
  voidedAt: string | null;
  closedBy: { fullName: string } | null;
};

export type MessageHit = { id: string; conversationId: string; senderType: Message['senderType']; text: string; internal: boolean; createdAt: string; channel: Channel; name: string; phone: string | null };

export type Template = { id: string; title: string; body: string };

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
  customers: number;
  phones: number;
  contact: number;
  closed: number;
  guests: number;
  revenue: Record<Channel, number>;
  totalRevenue: number;
  tours: { name: string; orders: number; guests: number; revenue: number }[];
  staff: { name: string; contact: number; closed: number; revenue: number; responses: number; avgSeconds: number | null }[];
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
  role: 'ADMIN' | 'SALE';
  isActive: boolean;
  lastLoginAt: string | null;
};
