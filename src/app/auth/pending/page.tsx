import Link from "next/link";

/** หน้ารออนุมัติ — แสดงเมื่อ login สำเร็จแต่ profile.status != approved */
export default function PendingPage() {
  return (
    <div className="min-h-svh w-full flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-3xl">hourglass_top</span>
        </div>
        <h1 className="text-lg font-bold text-slate-900">บัญชีรอการอนุมัติ</h1>
        <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">
          บัญชีของคุณถูกสร้างแล้ว แต่ยังรอผู้ดูแลระบบอนุมัติและกำหนดสิทธิ์
          กรุณาติดต่อผู้ดูแลระบบ หรือกลับมาเข้าสู่ระบบอีกครั้งภายหลัง
        </p>
        <Link
          href="/"
          className="inline-block mt-5 px-4 py-2.5 rounded-xl bg-[#d32029] text-white text-[14px] font-semibold hover:-translate-y-0.5 transition-all"
        >
          กลับหน้าเข้าสู่ระบบ
        </Link>
      </div>
    </div>
  );
}
