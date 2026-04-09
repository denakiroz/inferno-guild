import MemberPotentialClient from "./MemberPotentialClient";

export const runtime = "nodejs";
export const metadata = { title: "Member Potential" };

export default function MemberPotentialPage() {
  return <MemberPotentialClient />;
}
