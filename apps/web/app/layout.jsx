import { Bungee, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const display = Bungee({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display"
});

const body = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata = {
  title: "SharkTank Stage",
  description: "Interactive stage mock powered by Next.js and TailwindCSS"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} min-h-screen bg-black text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
