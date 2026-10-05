import { loadEnvConfig } from "@next/env";
import { PrismaClient, type MenuItem } from "@prisma/client";
import bcrypt from "bcryptjs";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const restaurantName = "Café Anoush";
const demoPin = "1234";

const menu = [
  {
    nameFa: "کباب‌ها",
    nameEn: "Kebabs",
    items: [
      { nameFa: "چلو کباب کوبیده", nameEn: "Chelo Kabab Koobideh", priceToman: 420000 },
      { nameFa: "جوجه کباب", nameEn: "Joojeh Kabab", priceToman: 460000 },
      { nameFa: "چلو کباب برگ", nameEn: "Chelo Kabab Barg", priceToman: 720000 },
      { nameFa: "کباب سلطانی", nameEn: "Kabab Soltani", priceToman: 920000 },
    ],
  },
  {
    nameFa: "خورش‌ها",
    nameEn: "Stews",
    items: [
      { nameFa: "قرمه سبزی با برنج", nameEn: "Ghormeh Sabzi with Rice", priceToman: 380000 },
      { nameFa: "قیمه با برنج", nameEn: "Gheymeh with Rice", priceToman: 360000 },
      { nameFa: "فسنجان با برنج", nameEn: "Fesenjan with rice", priceToman: 520000 },
      { nameFa: "خورش بادمجان", nameEn: "Khoresh Bademjan", priceToman: 390000 },
    ],
  },
  {
    nameFa: "پلو",
    nameEn: "Rice Dishes",
    items: [
      { nameFa: "زرشک پلو با مرغ", nameEn: "Zereshk Polo with Chicken", priceToman: 390000 },
      { nameFa: "باقالی‌پلو با گوشت", nameEn: "Baghali Polo with lamb", priceToman: 610000 },
      { nameFa: "ته‌چین مرغ", nameEn: "Tahchin Morgh", priceToman: 420000 },
      { nameFa: "عدس‌پلو", nameEn: "Adas Polo", priceToman: 320000 },
    ],
  },
  {
    nameFa: "پیش‌غذا",
    nameEn: "Appetizers",
    items: [
      { nameFa: "سالاد شیرازی", nameEn: "Shirazi Salad", priceToman: 95000 },
      { nameFa: "ماست و خیار", nameEn: "Mast-o Khiar", priceToman: 85000 },
      { nameFa: "کشک بادمجان", nameEn: "Kashk-e Bademjan", priceToman: 165000 },
      { nameFa: "سوپ روز", nameEn: "Soup of the Day", priceToman: 120000 },
    ],
  },
  {
    nameFa: "نوشیدنی‌ها",
    nameEn: "Drinks",
    items: [
      { nameFa: "دوغ", nameEn: "Doogh", priceToman: 45000 },
      { nameFa: "نوشابه گازدار", nameEn: "Soft Drink", priceToman: 40000 },
      { nameFa: "آب معدنی", nameEn: "Mineral Water", priceToman: 20000 },
      { nameFa: "چای", nameEn: "Chai", priceToman: 25000 },
    ],
  },
  {
    nameFa: "دسر",
    nameEn: "Desserts",
    items: [
      { nameFa: "بستنی سنتی", nameEn: "Bastani Sonnati", priceToman: 120000 },
      { nameFa: "فالوده شیرازی", nameEn: "Faloodeh Shirazi", priceToman: 85000 },
      { nameFa: "شله‌زرد", nameEn: "Sholeh Zard", priceToman: 70000 },
      { nameFa: "کیک روز", nameEn: "Cake of the Day", priceToman: 110000 },
    ],
  },
];

function atYesterday(hour: number, minute: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function removeExistingDemoRestaurant(): Promise<void> {
  // Rebuild only this demo tenant; reruns replace its orders, staff, and menu.
  const existing = await prisma.restaurant.findMany({
    where: { name: restaurantName },
    select: { id: true },
  });

  for (const restaurant of existing) {
    await prisma.$transaction(async (tx) => {
      await tx.orderEvent.deleteMany({
        where: { order: { is: { restaurantId: restaurant.id } } },
      });
      await tx.orderItem.deleteMany({
        where: { order: { is: { restaurantId: restaurant.id } } },
      });
      await tx.order.deleteMany({ where: { restaurantId: restaurant.id } });
      await tx.user.deleteMany({ where: { restaurantId: restaurant.id } });
      await tx.menuItem.deleteMany({ where: { restaurantId: restaurant.id } });
      await tx.menuCategory.deleteMany({ where: { restaurantId: restaurant.id } });
      await tx.table.deleteMany({
        where: { branch: { is: { restaurantId: restaurant.id } } },
      });
      await tx.branch.deleteMany({ where: { restaurantId: restaurant.id } });
      await tx.restaurant.delete({ where: { id: restaurant.id } });
    });
  }
}

async function seedKababiSalar(): Promise<string> {
  const existing = await prisma.restaurant.findFirst({
    where: { name: "Kababi Salar" },
    select: { id: true },
  });
  if (existing) {
    console.log("Kababi Salar already exists; leaving its data unchanged.");
    return existing.id;
  }

  return prisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.create({
      data: { name: "Kababi Salar" },
    });
    const branch = await tx.branch.create({
      data: { restaurantId: restaurant.id, name: "Tehran" },
    });
    await tx.table.createMany({
      data: Array.from({ length: 4 }, (_, index) => ({
        branchId: branch.id,
        label: String(index + 1),
        seats: 4,
      })),
    });

    const category = await tx.menuCategory.create({
      data: {
        restaurantId: restaurant.id,
        nameFa: "کباب‌ها",
        nameEn: "Kebabs",
        sort: 1,
      },
    });
    const menuItem = await tx.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: category.id,
        nameFa: "چلو کباب کوبیده",
        nameEn: "Chelo Kabab Koobideh",
        priceToman: 420000,
      },
    });
    const [manager, waiter] = await Promise.all([
      tx.user.create({
        data: {
          restaurantId: restaurant.id,
          branchId: null,
          staffCode: "S-900",
          name: "Salar Katouzian",
          role: "MANAGER",
          pinHash: await bcrypt.hash(demoPin, 12),
        },
      }),
      tx.user.create({
        data: {
          restaurantId: restaurant.id,
          branchId: branch.id,
          staffCode: "S-901",
          name: "Nima Rad",
          role: "WAITER",
          pinHash: await bcrypt.hash(demoPin, 12),
        },
      }),
    ]);

    const createdAt = atYesterday(18, 0);
    const table = await tx.table.findUniqueOrThrow({
      where: { branchId_label: { branchId: branch.id, label: "1" } },
      select: { id: true },
    });
    const order = await tx.order.create({
      data: {
        restaurantId: restaurant.id,
        branchId: branch.id,
        tableId: table.id,
        openedById: waiter.id,
        status: "OPEN",
        createdAt,
        updatedAt: createdAt,
      },
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorId: waiter.id,
        type: "ORDER_OPENED",
        detail: JSON.stringify({ table: "1" }),
        createdAt,
      },
    });

    const itemAddedAt = new Date(createdAt.getTime() + 60_000);
    const orderItem = await tx.orderItem.create({
      data: {
        orderId: order.id,
        menuItemId: menuItem.id,
        nameFa: menuItem.nameFa,
        nameEn: menuItem.nameEn,
        priceToman: menuItem.priceToman,
        qty: 2,
        createdAt: itemAddedAt,
        updatedAt: itemAddedAt,
      },
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorId: waiter.id,
        type: "ITEM_ADDED",
        detail: JSON.stringify({ orderItemId: orderItem.id, menuItemId: menuItem.id, qty: 2 }),
        createdAt: itemAddedAt,
      },
    });

    const readyAt = new Date(createdAt.getTime() + 20 * 60_000);
    await tx.orderItem.update({
      where: { id: orderItem.id },
      data: { status: "SERVED", updatedAt: readyAt },
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorId: manager.id,
        type: "ITEM_STATUS_CHANGED",
        detail: JSON.stringify({ orderItemId: orderItem.id, from: "PENDING", to: "SERVED" }),
        createdAt: readyAt,
      },
    });

    const billRequestedAt = new Date(readyAt.getTime() + 5 * 60_000);
    await tx.order.update({
      where: { id: order.id },
      data: { status: "BILL_REQUESTED", updatedAt: billRequestedAt },
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorId: waiter.id,
        type: "BILL_REQUESTED",
        detail: JSON.stringify({}),
        createdAt: billRequestedAt,
      },
    });

    const paidAt = new Date(billRequestedAt.getTime() + 5 * 60_000);
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentMethod: "POS_CARD",
        paidAt,
        closedAt: paidAt,
        updatedAt: paidAt,
      },
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorId: manager.id,
        type: "PAYMENT_RECORDED",
        detail: JSON.stringify({ paymentMethod: "POS_CARD" }),
        createdAt: paidAt,
      },
    });

    return restaurant.id;
  });
}

async function main(): Promise<void> {
  await removeExistingDemoRestaurant();

  const restaurant = await prisma.restaurant.create({
    data: { name: restaurantName },
  });
  const valiasr = await prisma.branch.create({
    data: { restaurantId: restaurant.id, name: "Valiasr" },
  });
  const saadatAbad = await prisma.branch.create({
    data: { restaurantId: restaurant.id, name: "Saadat Abad" },
  });

  await prisma.table.createMany({
    data: [
      ...Array.from({ length: 10 }, (_, index) => ({
        branchId: valiasr.id,
        label: String(index + 1),
        seats: 4,
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        branchId: saadatAbad.id,
        label: String(index + 1),
        seats: 4,
      })),
    ],
  });

  const categoriesByName = new Map<string, string>();
  const menuItemsByName = new Map<string, MenuItem>();
  for (const [sort, categoryData] of menu.entries()) {
    const category = await prisma.menuCategory.create({
      data: {
        restaurantId: restaurant.id,
        nameFa: categoryData.nameFa,
        nameEn: categoryData.nameEn,
        sort,
      },
    });
    categoriesByName.set(categoryData.nameEn, category.id);

    const items = await Promise.all(
      categoryData.items.map((item) =>
        prisma.menuItem.create({
          data: {
            restaurantId: restaurant.id,
            categoryId: category.id,
            ...item,
          },
        }),
      ),
    );
    for (const item of items) {
      menuItemsByName.set(item.nameEn, item);
    }
  }

  const staff = [
    { staffCode: "M-001", name: "Anoush Kamali", role: "MANAGER" as const, branchId: null },
    { staffCode: "W-101", name: "Reza Mousavi", role: "WAITER" as const, branchId: valiasr.id },
    { staffCode: "W-102", name: "Maryam Tehrani", role: "WAITER" as const, branchId: valiasr.id },
    { staffCode: "W-103", name: "Hamed Rezaei", role: "WAITER" as const, branchId: saadatAbad.id },
    { staffCode: "K-201", name: "Karim Ahmadi", role: "KITCHEN" as const, branchId: valiasr.id },
    { staffCode: "K-202", name: "Saeed Nazari", role: "KITCHEN" as const, branchId: saadatAbad.id },
    { staffCode: "C-301", name: "Sara Karimi", role: "CASHIER" as const, branchId: valiasr.id },
    { staffCode: "C-302", name: "Omid Farhadi", role: "CASHIER" as const, branchId: saadatAbad.id },
  ];
  const usersByCode = new Map<string, string>();
  for (const member of staff) {
    const user = await prisma.user.create({
      data: {
        restaurantId: restaurant.id,
        pinHash: await bcrypt.hash(demoPin, 12),
        ...member,
      },
    });
    usersByCode.set(member.staffCode, user.id);
  }

  async function recordEvent(
    orderId: string,
    actorId: string,
    type: string,
    detail: unknown,
    createdAt: Date,
  ): Promise<void> {
    await prisma.orderEvent.create({
      data: {
        orderId,
        actorId,
        type,
        detail: JSON.stringify(detail),
        createdAt,
      },
    });
  }

  async function createOrder(
    tableLabel: string,
    openedByCode: string,
    createdAt: Date,
  ) {
    const table = await prisma.table.findUniqueOrThrow({
      where: { branchId_label: { branchId: valiasr.id, label: tableLabel } },
    });
    const openedById = usersByCode.get(openedByCode);
    if (!openedById) {
      throw new Error(`Missing staff member ${openedByCode}`);
    }
    const order = await prisma.order.create({
      data: {
        restaurantId: restaurant.id,
        branchId: valiasr.id,
        tableId: table.id,
        openedById,
        createdAt,
        updatedAt: createdAt,
      },
    });
    await recordEvent(order.id, openedById, "ORDER_OPENED", { table: tableLabel }, createdAt);
    return order;
  }

  async function addOrderItem(
    orderId: string,
    actorCode: string,
    menuName: string,
    qty: number,
    note: string | null,
    createdAt: Date,
  ) {
    const menuItem = menuItemsByName.get(menuName);
    const actorId = usersByCode.get(actorCode);
    if (!menuItem || !actorId) {
      throw new Error(`Missing menu item or staff member for ${menuName}`);
    }
    const orderItem = await prisma.orderItem.create({
      data: {
        orderId,
        menuItemId: menuItem.id,
        nameFa: menuItem.nameFa,
        nameEn: menuItem.nameEn,
        priceToman: menuItem.priceToman,
        qty,
        note,
        createdAt,
        updatedAt: createdAt,
      },
    });
    await recordEvent(
      orderId,
      actorId,
      "ITEM_ADDED",
      { orderItemId: orderItem.id, menuItemId: menuItem.id, qty, note },
      createdAt,
    );
    return orderItem;
  }

  async function changeItemStatus(
    orderId: string,
    itemId: string,
    actorCode: string,
    status: "PREPARING" | "READY" | "SERVED",
    changedAt: Date,
  ): Promise<void> {
    const actorId = usersByCode.get(actorCode);
    if (!actorId) {
      throw new Error(`Missing staff member ${actorCode}`);
    }
    const current = await prisma.orderItem.findUniqueOrThrow({
      where: { id: itemId },
      select: { status: true },
    });
    await prisma.orderItem.update({
      where: { id: itemId },
      data: { status, updatedAt: changedAt },
    });
    await recordEvent(
      orderId,
      actorId,
      "ITEM_STATUS_CHANGED",
      { orderItemId: itemId, from: current.status, to: status },
      changedAt,
    );
  }

  async function requestBill(orderId: string, actorCode: string, requestedAt: Date) {
    const actorId = usersByCode.get(actorCode);
    if (!actorId) {
      throw new Error(`Missing staff member ${actorCode}`);
    }
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "BILL_REQUESTED", updatedAt: requestedAt },
    });
    await recordEvent(orderId, actorId, "BILL_REQUESTED", {}, requestedAt);
  }

  const openOrder = await createOrder("5", "W-101", new Date());
  const openItems = [];
  openItems.push(
    await addOrderItem(
      openOrder.id,
      "W-101",
      "Chelo Kabab Koobideh",
      2,
      "بدون پیاز / no onions",
      new Date(),
    ),
  );
  openItems.push(
    await addOrderItem(openOrder.id, "W-101", "Joojeh Kabab", 1, null, new Date()),
  );
  await addOrderItem(openOrder.id, "W-101", "Doogh", 2, null, new Date());
  await addOrderItem(openOrder.id, "W-101", "Shirazi Salad", 1, null, new Date());
  await changeItemStatus(openOrder.id, openItems[0].id, "K-201", "PREPARING", new Date());
  await changeItemStatus(openOrder.id, openItems[1].id, "K-201", "PREPARING", new Date());

  const billOrder = await createOrder("3", "W-102", new Date());
  const billItems = [
    await addOrderItem(billOrder.id, "W-102", "Ghormeh Sabzi with Rice", 1, null, new Date()),
    await addOrderItem(billOrder.id, "W-102", "Kashk-e Bademjan", 1, null, new Date()),
    await addOrderItem(billOrder.id, "W-102", "Doogh", 2, null, new Date()),
  ];
  for (const item of billItems) {
    await changeItemStatus(billOrder.id, item.id, "K-201", "READY", new Date());
  }
  await requestBill(billOrder.id, "W-102", new Date());

  const paidOrders = [
    {
      table: "1",
      waiter: "W-101",
      cashier: "C-301",
      paymentMethod: "POS_CARD" as const,
      hour: 17,
      minute: 45,
      discountToman: 0,
      discountReason: null,
      items: [
        { name: "Chelo Kabab Koobideh", qty: 2 },
        { name: "Doogh", qty: 2 },
        { name: "Shirazi Salad", qty: 1 },
      ],
    },
    {
      table: "7",
      waiter: "W-102",
      cashier: "C-301",
      paymentMethod: "CASH" as const,
      hour: 19,
      minute: 10,
      discountToman: 50000,
      discountReason: "تخفیف بابت تأخیر / Service recovery for delay",
      items: [
        { name: "Joojeh Kabab", qty: 2 },
        { name: "Mast-o Khiar", qty: 1 },
        { name: "Chai", qty: 2 },
      ],
    },
    {
      table: "9",
      waiter: "W-101",
      cashier: "C-301",
      paymentMethod: "CARD_TO_CARD" as const,
      hour: 20,
      minute: 35,
      discountToman: 0,
      discountReason: null,
      items: [
        { name: "Ghormeh Sabzi with Rice", qty: 1 },
        { name: "Bastani Sonnati", qty: 1 },
        { name: "Doogh", qty: 1 },
      ],
    },
  ];

  for (const paidData of paidOrders) {
    const openedAt = atYesterday(paidData.hour, paidData.minute);
    const order = await createOrder(paidData.table, paidData.waiter, openedAt);
    const items = [];
    let changedAt = new Date(openedAt.getTime() + 60_000);
    for (const item of paidData.items) {
      items.push(
        await addOrderItem(order.id, paidData.waiter, item.name, item.qty, null, changedAt),
      );
      changedAt = new Date(changedAt.getTime() + 15_000);
    }

    for (const item of items) {
      for (const status of ["PREPARING", "READY", "SERVED"] as const) {
        changedAt = new Date(changedAt.getTime() + 2 * 60_000);
        await changeItemStatus(order.id, item.id, "K-201", status, changedAt);
      }
    }

    changedAt = new Date(changedAt.getTime() + 2 * 60_000);
    await requestBill(order.id, paidData.waiter, changedAt);
    const paidAt = new Date(changedAt.getTime() + 5 * 60_000);
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentMethod: paidData.paymentMethod,
        discountToman: paidData.discountToman,
        discountReason: paidData.discountReason,
        paidAt,
        closedAt: paidAt,
        updatedAt: paidAt,
      },
    });
    if (paidData.discountToman > 0) {
      const managerId = usersByCode.get("M-001");
      if (!managerId) {
        throw new Error("Missing staff member M-001");
      }
      await recordEvent(
        order.id,
        managerId,
        "DISCOUNT_APPLIED",
        {
          discountToman: paidData.discountToman,
          discountReason: paidData.discountReason,
        },
        paidAt,
      );
    }
    const cashierId = usersByCode.get(paidData.cashier);
    if (!cashierId) {
      throw new Error(`Missing staff member ${paidData.cashier}`);
    }
    await recordEvent(
      order.id,
      cashierId,
      "PAYMENT_RECORDED",
      {
        paymentMethod: paidData.paymentMethod,
        discountToman: paidData.discountToman,
        discountReason: paidData.discountReason,
      },
      paidAt,
    );
  }

  const salarRestaurantId = await seedKababiSalar();
  const credentials = await prisma.user.findMany({
    where: { restaurantId: { in: [restaurant.id, salarRestaurantId] } },
    select: {
      staffCode: true,
      role: true,
      pinHash: true,
      restaurant: { select: { name: true } },
    },
    orderBy: [{ restaurant: { name: "asc" } }, { staffCode: "asc" }],
  });
  const credentialRows = await Promise.all(
    credentials.map(async (user) => ({
      restaurant: user.restaurant.name,
      staffCode: user.staffCode,
      pin: (await bcrypt.compare(demoPin, user.pinHash)) ? demoPin : "unchanged",
      role: user.role,
    })),
  );

  console.log(
    `Seeded ${restaurantName}: ${categoriesByName.size} categories, ${menuItemsByName.size} menu items, ${staff.length} staff, 5 Valiasr orders.`,
  );
  console.log("Staff credentials by restaurant (PIN is shown only when verified):");
  console.table(credentialRows);
}

main()
  .catch((error: unknown) => {
    console.error("Prisma seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
