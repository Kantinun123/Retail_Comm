"use client";

/* =============================================================
   หน้าสอบถาม (FAQ Chatbot) — ตอบจากชุดคำถาม-คำตอบที่เตรียมไว้
   ไม่ต่อ backend/AI ภายนอก ทำงานในเครื่องทันที
   ============================================================= */
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { useSession } from "@/lib/commission/session";
import { cn } from "@/lib/utils";

interface ChatMsg {
  id: number;
  from: "bot" | "user";
  text: string;
}

/** ชุด FAQ: keyword -> คำตอบ. จับคู่จากคำที่ผู้ใช้พิมพ์ */
interface Faq {
  q: string; // ปุ่มคำถามยอดฮิต (ข้อความที่ผู้ใช้ "ถาม")
  keywords: string[];
  a: string;
}
const FAQS: Faq[] = [
  {
    q: "ค่าคอมมิชชันคำนวณอย่างไร",
    keywords: ["คำนวณ", "คิดยังไง", "คิดอย่างไร", "สูตร", "rate", "อัตรา"],
    a: "ค่าคอมมิชชัน/ผลประโยชน์คำนวณจาก ยอดขายที่ใช้คำนวณ × อัตราผลประโยชน์ (Rate) ของแต่ละงาน โดยฝั่งร้านค้าเป็น Commission/Back Margin ส่วนฝั่งพนักงานเป็น Incentive ดูรายละเอียดต่องานได้ในหน้าภาพรวม > แยกตามพนักงาน",
  },
  {
    q: "รอบจ่ายเงินเมื่อไหร่",
    keywords: ["รอบ", "จ่ายเมื่อไหร่", "โอน", "วันจ่าย", "ตัดรอบ", "กี่วัน"],
    a: "ระบบตัดรอบและโอนจ่ายตามรอบที่กำหนด (ดูได้จากคอลัมน์ 'วันที่โอนจ่าย') สถานะจะแสดงเป็น 'จ่ายแล้ว' เมื่อโอนเรียบร้อย และ 'รอจ่าย' เมื่อยังไม่ถึงกำหนด",
  },
  {
    q: "Back Margin คืออะไร",
    keywords: ["back margin", "แบ็คมาร์จิน", "di", "ประเภทผลประโยชน์"],
    a: "Back Margin เป็นประเภทผลประโยชน์ของฝั่งร้านค้าที่มาจากข้อมูลแหล่ง DI ส่วน Commission มาจากแหล่ง BA/Netsuite — ดูแยกประเภทได้ในกล่อง 'ผลประโยชน์แยกตามประเภทการจ่าย'",
  },
  {
    q: "ดูข้อมูลย้อนหลัง / กรองช่วงเวลา",
    keywords: ["ย้อนหลัง", "กรอง", "ช่วงเวลา", "เดือน", "ตัวกรอง", "วันที่"],
    a: "กดปุ่ม 'ตัวกรองข้อมูล' ด้านบนของหน้าภาพรวม เลือกได้ทั้งแบบปี-เดือน หรือช่วงวันที่ และเลือกประเภทวันที่ (วันที่ปิดขาย/วันที่โอนจ่าย) รวมถึงกรองตามสถานะ ประเภทผลประโยชน์ และกลุ่มงานได้",
  },
  {
    q: "ดาวน์โหลดข้อมูลเป็น Excel",
    keywords: ["ดาวน์โหลด", "excel", "export", "ไฟล์", "โหลด"],
    a: "กดปุ่ม 'ดาวน์โหลดข้อมูล' ที่การ์ดสรุปด้านบน ระบบจะส่งออกไฟล์ Excel ที่ตรงกับตารางและตัวกรองที่เลือกอยู่",
  },
  {
    q: "ติดต่อเจ้าหน้าที่",
    keywords: ["ติดต่อ", "เจ้าหน้าที่", "โทร", "เบอร์", "support", "ช่วยเหลือ", "คน"],
    a: "ติดต่อเจ้าหน้าที่ Dealer Care Center ได้ที่ โทร 02-586-2222 (จ.-ศ. 8:30-17:30 น.) หรืออีเมล support@retail-comm.local — ทีมงานยินดีช่วยเหลือครับ",
  },
];

const GREETING =
  "สวัสดีครับ 👋 ผมเป็นผู้ช่วยตอบคำถามอัตโนมัติ ลองเลือกคำถามด้านล่าง หรือพิมพ์คำถามของคุณได้เลยครับ";
const FALLBACK =
  "ขออภัยครับ ผมยังไม่มีคำตอบสำหรับคำถามนี้ ลองเลือกจากคำถามยอดฮิตด้านล่าง หรือพิมพ์คำว่า 'ติดต่อเจ้าหน้าที่' เพื่อขอความช่วยเหลือจากทีมงานครับ";

/** หาคำตอบจากข้อความผู้ใช้ (จับ keyword) */
function findAnswer(text: string): string {
  const t = text.toLowerCase();
  const hit = FAQS.find(
    (f) =>
      f.keywords.some((k) => t.includes(k.toLowerCase())) ||
      t.includes(f.q.toLowerCase())
  );
  return hit ? hit.a : FALLBACK;
}

export function ChatScreen() {
  const { session, ready } = useSession();
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: 1, from: "bot", text: GREETING },
  ]);
  const [input, setInput] = useState("");
  const nextId = useRef(2);
  const scrollRef = useRef<HTMLDivElement>(null);

  // เลื่อนลงล่างสุดเมื่อมีข้อความใหม่
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    const userMsg: ChatMsg = { id: nextId.current++, from: "user", text: q };
    const botMsg: ChatMsg = {
      id: nextId.current++,
      from: "bot",
      text: findAnswer(q),
    };
    setMessages((m) => [...m, userMsg, botMsg]);
    setInput("");
  }

  if (!ready || !session) return null;

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#d32029] to-[#8f1114] text-white flex items-center justify-center">
            <Icon name="support_agent" className="text-xl" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[15px] text-[#231313] leading-tight">
              สอบถาม / ช่วยเหลือ
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              ผู้ช่วยอัตโนมัติ · ออนไลน์
            </span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 py-3 pb-2"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex",
              m.from === "user" ? "justify-end" : "justify-start"
            )}
          >
            {m.from === "bot" && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#d32029] to-[#8f1114] text-white flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <Icon name="smart_toy" style={{ fontSize: 15 }} />
              </div>
            )}
            <div
              className={cn(
                "max-w-[78%] px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm",
                m.from === "user"
                  ? "bg-gradient-to-br from-[#d32029] to-[#c01f27] text-white rounded-2xl rounded-br-md"
                  : "bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-bl-md"
              )}
            >
              {m.text}
            </div>
          </div>
        ))}

        {/* ปุ่มคำถามยอดฮิต */}
        <div className="pt-1">
          <p className="text-[11px] text-slate-400 mb-1.5 pl-1">คำถามยอดฮิต</p>
          <div className="flex flex-wrap gap-1.5">
            {FAQS.map((f) => (
              <button
                key={f.q}
                type="button"
                onClick={() => send(f.q)}
                className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-[12px] font-medium text-slate-600 hover:border-[#d32029] hover:text-[#a11119] active:scale-95 transition"
              >
                {f.q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-16 bg-[#f7f4f4] pt-2 pb-1">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์คำถามของคุณ…"
            className="flex-1 bg-white text-slate-800 text-[14px] rounded-full px-4 py-2.5 border border-slate-200 focus:border-[#d32029] focus:ring-2 focus:ring-[#d32029]/15 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-11 h-11 rounded-full bg-gradient-to-br from-[#d32029] to-[#c01f27] text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#d32029]/25 active:scale-95 transition disabled:opacity-40"
          >
            <Icon name="send" className="text-xl" />
          </button>
        </form>
      </div>

      <BottomNav active="chat" />
    </>
  );
}
