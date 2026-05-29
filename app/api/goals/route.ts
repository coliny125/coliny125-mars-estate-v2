import { NextRequest, NextResponse } from "next/server";
import { getGoals, saveGoals } from "@/lib/goals";
import type { Goal, GoalStatus } from "@/lib/goals";

const SEED_GOALS: Goal[] = [
  {
    id: "goal-01",
    title: "Top 5 Napa vineyard within 5 years",
    description: "Reach top 5 vineyard ranking in Napa Valley by critic scores and brand recognition.",
    target: "2027",
    status: "on_track",
    notes: "98pt James Suckling score on second wine (May 2026). Wine Advocate and Jancis Robinson pending.",
    updated_at: new Date().toISOString(),
  },
  {
    id: "goal-02",
    title: "$400 retail price for Estate Cabernet",
    description: "Establish and hold $400 as the target retail price — signaling cult-winery positioning.",
    target: "2026 release",
    status: "on_track",
    notes: "Pricing strategy set. No discounting policy in place.",
    updated_at: new Date().toISOString(),
  },
  {
    id: "goal-03",
    title: "Launch Founding Circle membership",
    description: "First 50 members of the Founding Circle — apostles who believe in the brand from the start.",
    target: "Before Thanksgiving 2026",
    status: "at_risk",
    notes: "Application draft in progress with Harry. Benefits structure and pricing still being finalized.",
    updated_at: new Date().toISOString(),
  },
  {
    id: "goal-04",
    title: "Website live (Land / Wines / Notes)",
    description: "Full Mars Estate website with the three-section concept approved April 22.",
    target: "July–August 2026",
    status: "at_risk",
    notes: "Nicola Parisi first shoot done (May 1). Landing page copy still needed for Offset Partners.",
    updated_at: new Date().toISOString(),
  },
  {
    id: "goal-05",
    title: "Bottle 2024 Cabernet Sauvignon",
    description: "Complete 2024 Cab bottling at Joseph Cellars.",
    target: "May 18–19, 2026",
    status: "completed",
    notes: "Glass, corks, and labels delivered. Bottling week completed.",
    updated_at: new Date().toISOString(),
  },
  {
    id: "goal-06",
    title: "Bottle 2024 Chardonnay",
    description: "~750 cases of Chardonnay from Lafranchi Ranch fruit.",
    target: "June 22, 2026",
    status: "on_track",
    notes: "Chardonnay labels due June 1.",
    updated_at: new Date().toISOString(),
  },
  {
    id: "goal-07",
    title: "Select architecture firm for hospitality center",
    description: "Commit to Walker Warner, Butler Armsden, or Field Architects for the Howell Mountain estate hospitality center.",
    target: "Q3 2026",
    status: "blocked",
    notes: "Three firms under evaluation. Land use questions need to go to lawyers first.",
    updated_at: new Date().toISOString(),
  },
  {
    id: "goal-08",
    title: "DTC e-commerce fully live",
    description: "Offset Commerce platform operational with all state compliance, fulfillment, and transactional email configured.",
    target: "Summer 2026",
    status: "at_risk",
    notes: "Multiple overdue setup tasks: CRV collection, Colorado delivery fee, Maine bottle deposit, transactional emails.",
    updated_at: new Date().toISOString(),
  },
];

export async function GET() {
  let goals = await getGoals();
  if (goals.length === 0) {
    goals = SEED_GOALS;
    await saveGoals(goals);
  }
  return NextResponse.json({ goals });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const goals = await getGoals();
  const goal: Goal = {
    id: `goal-${crypto.randomUUID().slice(0, 8)}`,
    title: body.title,
    description: body.description ?? "",
    target: body.target,
    status: (body.status as GoalStatus) ?? "on_track",
    notes: body.notes,
    updated_at: new Date().toISOString(),
  };
  goals.push(goal);
  await saveGoals(goals);
  return NextResponse.json({ goal });
}
