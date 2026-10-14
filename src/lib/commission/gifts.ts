/* =============================================================
   Catalog ของรางวัลสำหรับแลกแต้ม (ข้อมูลตัวอย่าง static)
   แต้มในระบบนี้สุ่ม 1-500 ของรางวัลจึงตั้งราคาให้อยู่ในกรอบนั้น
   ============================================================= */
import type { GiftItem } from "./types";

export const GIFTS: GiftItem[] = [
  {
    id: "voucher-lotus-100",
    name: "บัตรกำนัลโลตัส ฿100",
    category: "บัตรกำนัล",
    icon: "shopping_cart",
    imageUrl: "/gifts/voucher-lotus.svg",
    cost: 50,
  },
  {
    id: "voucher-bigc-100",
    name: "บัตรกำนัลบิ๊กซี ฿100",
    category: "บัตรกำนัล",
    icon: "local_mall",
    imageUrl: "/gifts/voucher-bigc.svg",
    cost: 50,
  },
  {
    id: "voucher-grab-150",
    name: "Grab Voucher ฿150",
    category: "บัตรกำนัล",
    icon: "directions_car",
    imageUrl: "/gifts/voucher-grab.svg",
    cost: 75,
  },
  {
    id: "voucher-shopee-200",
    name: "Shopee Coins ฿200",
    category: "บัตรกำนัล",
    icon: "storefront",
    imageUrl: "/gifts/voucher-shopee.svg",
    cost: 100,
  },
  {
    id: "appliance-kettle",
    name: "กาต้มน้ำไฟฟ้า",
    category: "เครื่องใช้ไฟฟ้า",
    icon: "kettle",
    imageUrl: "/gifts/appliance-kettle.svg",
    cost: 180,
  },
  {
    id: "appliance-fan",
    name: "พัดลมตั้งพื้น",
    category: "เครื่องใช้ไฟฟ้า",
    icon: "mode_fan",
    imageUrl: "/gifts/appliance-fan.svg",
    cost: 250,
  },
  {
    id: "appliance-microwave",
    name: "ไมโครเวฟ",
    category: "เครื่องใช้ไฟฟ้า",
    icon: "microwave",
    imageUrl: "/gifts/appliance-microwave.svg",
    cost: 400,
  },
  {
    id: "appliance-tv",
    name: "ทีวี 32 นิ้ว",
    category: "เครื่องใช้ไฟฟ้า",
    icon: "tv",
    imageUrl: "/gifts/appliance-tv.svg",
    cost: 500,
  },
];

export function giftById(id: string): GiftItem | undefined {
  return GIFTS.find((g) => g.id === id);
}
