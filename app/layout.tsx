import "@/app/globals.css";
import React from "react";

export const metadata = {
  title: "Retros",
  description: "Herramienta para retros de Scrum"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl p-4">{children}</div>
      </body>
    </html>
  );
}


