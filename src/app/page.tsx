import { redirect } from "next/navigation";

export default function Home() {
  // 默认进入 chat 页
  redirect("/chat");
}
