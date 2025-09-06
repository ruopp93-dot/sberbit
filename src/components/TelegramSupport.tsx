"use client";

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    Telegram: {
      WebApp: unknown;
    };
  }
}

export function TelegramSupport() {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <a target="_blank" href="https://exnode.ru/">
        <img src="https://exnode.ru/exnode-logo.png" alt="Мониторинг обменников Exnode" title="Exnode - Мониторинг обменников" width="88" height="31" />
      </a>
    </div>
  );
}
