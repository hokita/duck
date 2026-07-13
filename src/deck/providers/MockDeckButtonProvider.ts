import type { DeckPage } from "../models/DeckPage";
import type { DeckButtonProvider } from "./DeckButtonProvider";

const MOCK_PAGES: DeckPage[] = [
  {
    id: "main",
    name: "Main",
    buttons: [
      {
        id: "backend",
        title: "Backend",
        subtitle: "Running",
        icon: "🖥️",
        status: "active",
        action: { type: "log", message: "Backend clicked" },
      },
      {
        id: "frontend",
        title: "Frontend",
        subtitle: "Running",
        icon: "🎨",
        status: "active",
        action: { type: "log", message: "Frontend clicked" },
      },
      {
        id: "batch",
        title: "Batch",
        subtitle: "3 jobs",
        icon: "📦",
        status: "working",
        badge: "3",
        action: { type: "log", message: "Batch clicked" },
      },
      {
        id: "working",
        title: "Working",
        subtitle: "Building…",
        icon: "🔄",
        status: "working",
        action: { type: "log", message: "Working clicked" },
      },
      {
        id: "next",
        title: "Next",
        icon: "➡️",
        action: { type: "navigate", pageId: "next" },
      },
      {
        id: "done",
        title: "Done",
        subtitle: "Completed",
        icon: "✅",
        status: "done",
        action: { type: "log", message: "Done clicked" },
      },
      {
        id: "warning",
        title: "Warning",
        subtitle: "Check logs",
        icon: "⚠️",
        status: "warning",
        badge: "!",
        action: { type: "log", message: "Warning clicked" },
      },
      {
        id: "error",
        title: "Error",
        subtitle: "Failed",
        icon: "⛔",
        status: "error",
        action: { type: "log", message: "Error clicked" },
      },
      {
        id: "mystery",
        title: "Mystery",
        subtitle: "Unknown action",
        icon: "🧪",
        action: { type: "custom", actionId: "does-not-exist" },
      },
      {
        id: "offline",
        title: "Offline",
        subtitle: "Disabled",
        icon: "🚫",
        disabled: true,
        action: { type: "log", message: "unreachable" },
      },
      {
        id: "tools-folder",
        title: "Tools",
        subtitle: "Folder",
        icon: "📁",
        action: { type: "navigate", pageId: "tools" },
      },
      {
        id: "open-app",
        title: "Open App",
        icon: "🚀",
        action: { type: "log", message: "Open App clicked" },
      },
      { id: "empty-1" },
      { id: "empty-2" },
      {
        id: "settings",
        title: "Settings",
        icon: "⚙️",
        action: { type: "custom", actionId: "open-settings" },
      },
    ],
  },
  {
    id: "tools",
    name: "Tools",
    buttons: [
      {
        id: "back",
        title: "Back",
        icon: "⬅️",
        action: { type: "navigate", pageId: "previous" },
      },
      {
        id: "home",
        title: "Home",
        icon: "🏠",
        action: { type: "navigate", pageId: "home" },
      },
      {
        id: "terminal",
        title: "Terminal",
        icon: "💻",
        action: { type: "log", message: "Terminal clicked" },
      },
      {
        id: "logs",
        title: "Logs",
        icon: "📜",
        action: { type: "log", message: "Logs clicked" },
      },
      {
        id: "deploy",
        title: "Deploy",
        subtitle: "In progress",
        icon: "🛳️",
        status: "working",
        action: { type: "log", message: "Deploy clicked" },
      },
      {
        id: "wall-folder",
        title: "Wall",
        subtitle: "Overflow demo",
        icon: "🧱",
        action: { type: "navigate", pageId: "wall" },
      },
    ],
  },
  {
    id: "wall",
    name: "Wall",
    buttons: [
      {
        id: "wall-back",
        title: "Back",
        icon: "⬅️",
        action: { type: "navigate", pageId: "previous" },
      },
      {
        id: "wall-home",
        title: "Home",
        icon: "🏠",
        action: { type: "navigate", pageId: "home" },
      },
      ...Array.from({ length: 18 }, (_, i) => ({
        id: `wall-${i + 1}`,
        title: `Tile ${i + 1}`,
        icon: "🔹",
        action: { type: "log" as const, message: `Tile ${i + 1} clicked` },
      })),
    ],
  },
];

export class MockDeckButtonProvider implements DeckButtonProvider {
  async getPages(): Promise<DeckPage[]> {
    return structuredClone(MOCK_PAGES);
  }
}
