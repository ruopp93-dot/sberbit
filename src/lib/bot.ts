// Telegram bot helper used by API routes. Safe no-op if env vars are missing.
import type { Api } from "grammy";
import { Bot } from "grammy";

type SimpleBot = { api: Api };

let botInstance: SimpleBot;

const token = process.env.TELEGRAM_BOT_TOKEN;

if (token) {
  // Create a Bot instance without starting long polling.
  // We only use the Bot API (bot.api.sendMessage) from server routes.
  botInstance = new Bot(token) as unknown as SimpleBot;
} else {
  // Fallback no-op api to avoid runtime crashes when env vars are absent.
  const noopApi: Partial<Api> = {
    async sendMessage(..._args: any[]): Promise<any> {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Telegram bot token is missing. Skipping sendMessage(). Set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID in .env.local"
        );
      }
      return Promise.resolve(undefined as unknown as never);
    },
    async editMessageText(..._args: any[]): Promise<any> {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Telegram bot token is missing. Skipping editMessageText(). Set TELEGRAM_BOT_TOKEN in .env.local"
        );
      }
      return Promise.resolve(undefined as unknown as never);
    },
    async answerCallbackQuery(..._args: any[]): Promise<any> {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Telegram bot token is missing. Skipping answerCallbackQuery(). Set TELEGRAM_BOT_TOKEN in .env.local"
        );
      }
      return Promise.resolve(undefined as unknown as never);
    },
  };
  botInstance = { api: noopApi as Api };
}

export const bot = botInstance;
