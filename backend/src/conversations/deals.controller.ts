import { Controller, Get, Query } from "@nestjs/common";
import { IsIn, IsOptional } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { dauKy } from "../stats/stats.service";

class DealsQuery {
  @IsOptional() @IsIn(["today", "week", "month", "all"]) period?:
    "today" | "week" | "month" | "all";
  @IsOptional() @IsIn(["PENDING", "CONFIRMED", "CANCELLED"]) status?:
    "PENDING" | "CONFIRMED" | "CANCELLED";
}

@Controller("deals")
export class DealsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() query: DealsQuery) {
    const since = dauKy(query.period ?? "all");
    const rows = await this.prisma.deal.findMany({
      where: {
        ...(!query.period || query.period === "all" ? {} : { createdAt: { gte: since } }),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        conversationId: true,
        channel: true,
        status: true,
        source: true,
        orderCode: true,
        tourCode: true,
        tourName: true,
        guests: true,
        amount: true,
        bookingStatus: true,
        createdAt: true,
        closedAt: true,
        voidedAt: true,
        customer: { select: { name: true, phone: true } },
        conversation: { select: { assignee: { select: { fullName: true } } } },
        closedBy: { select: { fullName: true } },
      },
    });
    return rows;
  }
}
