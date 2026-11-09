import { DealsController } from "./deals.controller";

describe("DealsController", () => {
  it("lists orders directly from deals with customer and assignee details", async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: "deal-1" }]);
    const controller = new DealsController({ deal: { findMany } } as never);
    await expect(controller.list({ period: "all" })).resolves.toEqual([
      { id: "deal-1" },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { createdAt: "desc" },
        select: expect.objectContaining({
          customer: expect.any(Object),
          conversation: expect.any(Object),
        }),
      }),
    );
  });

  it("uses the Vietnam day boundary for the today filter", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const controller = new DealsController({ deal: { findMany } } as never);
    await controller.list({ period: "today" });
    const query = findMany.mock.calls[0][0];
    expect(query.where.createdAt.gte).toBeInstanceOf(Date);
    expect(query.where.createdAt.gte.getUTCHours()).toBe(17);
  });
});
