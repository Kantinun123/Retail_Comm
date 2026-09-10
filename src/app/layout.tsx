import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "Retail-COMM | Commission Portal",
  description:
    "ระบบดูค่าคอมมิชชั่นการขาย Solution สำหรับร้านค้าตัวแทนจำหน่ายและพนักงานขายในเครือ SCG Network",
};

const prompt = Prompt({
  variable: "--font-prompt",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin", "thai"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className={`${prompt.variable} font-body antialiased`}>
        {children}
      </body>
    </html>
  );
}
