const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const timeline = [
  {
    title: "HACK THE HORIZON 2.0",
    description: "24-Hour National Hackathon",
    startTime: new Date("2026-09-24T10:00:00+05:30"),
    endTime: new Date("2026-09-25T12:30:00+05:30"),
    priority: 100,
  },
  {
    title: "Participant Registration & Check-in",
    description: "Registration desk open, kit distribution & badge check",
    startTime: new Date("2026-09-24T08:15:00+05:30"),
    endTime: new Date("2026-09-24T09:15:00+05:30"),
    priority: 1,
  },
  {
    title: "Inauguration Ceremony",
    description: "Welcome address, dignitaries speech & lighting the lamp",
    startTime: new Date("2026-09-24T09:15:00+05:30"),
    endTime: new Date("2026-09-24T09:50:00+05:30"),
    priority: 1,
  },
  {
    title: "Hackathon Briefing & Instructions",
    description: "Rules, evaluation criteria, mentor protocols & logistics briefing",
    startTime: new Date("2026-09-24T09:50:00+05:30"),
    endTime: new Date("2026-09-24T10:00:00+05:30"),
    priority: 1,
  },
  {
    title: "Hacking & Development - Phase 1",
    description: "Official hackathon begins. Architecture setup and foundational sprint",
    startTime: new Date("2026-09-24T10:00:00+05:30"),
    endTime: new Date("2026-09-24T13:00:00+05:30"),
    priority: 2,
  },
  {
    title: "Lunch",
    description: "Lunch break for all participants and mentors",
    startTime: new Date("2026-09-24T13:00:00+05:30"),
    endTime: new Date("2026-09-24T14:00:00+05:30"),
    priority: 1,
  },
  {
    title: "Hacking & Development - Phase 2",
    description: "Core feature development and API integrations",
    startTime: new Date("2026-09-24T14:00:00+05:30"),
    endTime: new Date("2026-09-24T16:45:00+05:30"),
    priority: 2,
  },
  {
    title: "Evening Snack",
    description: "Refreshment & evening tea break",
    startTime: new Date("2026-09-24T16:45:00+05:30"),
    endTime: new Date("2026-09-24T17:00:00+05:30"),
    priority: 1,
  },
  {
    title: "Hacking & Development - Phase 3",
    description: "Mentorship review round and module progress check",
    startTime: new Date("2026-09-24T17:00:00+05:30"),
    endTime: new Date("2026-09-24T19:30:00+05:30"),
    priority: 2,
  },
  {
    title: "Dinner",
    description: "Dinner break & recharge session",
    startTime: new Date("2026-09-24T19:30:00+05:30"),
    endTime: new Date("2026-09-24T20:30:00+05:30"),
    priority: 1,
  },
  {
    title: "Hacking & Development - Phase 4",
    description: "Deep work session & advanced algorithm integration",
    startTime: new Date("2026-09-24T20:30:00+05:30"),
    endTime: new Date("2026-09-25T00:30:00+05:30"),
    priority: 2,
  },
  {
    title: "Night Snack",
    description: "Midnight energy snacks and hot beverages",
    startTime: new Date("2026-09-25T00:30:00+05:30"),
    endTime: new Date("2026-09-25T01:00:00+05:30"),
    priority: 1,
  },
  {
    title: "Hacking & Development - Night Session",
    description: "Overnight hack sprint and prototype refinement",
    startTime: new Date("2026-09-25T01:00:00+05:30"),
    endTime: new Date("2026-09-25T04:00:00+05:30"),
    priority: 2,
  },
  {
    title: "Final Development, Testing & Integration",
    description: "Bug fixing, QA validation, and edge case resolution",
    startTime: new Date("2026-09-25T04:00:00+05:30"),
    endTime: new Date("2026-09-25T05:30:00+05:30"),
    priority: 2,
  },
  {
    title: "Early Morning Snack",
    description: "Morning coffee and light refreshments",
    startTime: new Date("2026-09-25T05:30:00+05:30"),
    endTime: new Date("2026-09-25T06:00:00+05:30"),
    priority: 1,
  },
  {
    title: "Final Development, Testing & Integration",
    description: "Deployment, code freeze preparation, and presentation decks",
    startTime: new Date("2026-09-25T06:00:00+05:30"),
    endTime: new Date("2026-09-25T07:30:00+05:30"),
    priority: 2,
  },
  {
    title: "Breakfast",
    description: "Morning breakfast and preparation for evaluation",
    startTime: new Date("2026-09-25T07:30:00+05:30"),
    endTime: new Date("2026-09-25T08:30:00+05:30"),
    priority: 1,
  },
  {
    title: "Final Evaluation",
    description: "Jury presentation, live demo evaluation & scorecards",
    startTime: new Date("2026-09-25T08:45:00+05:30"),
    endTime: new Date("2026-09-25T12:30:00+05:30"),
    priority: 3,
  },
  {
    title: "HACKATHON ENDS",
    description: "Closing ceremony, winner announcements & felicitations",
    startTime: new Date("2026-09-25T12:30:00+05:30"),
    endTime: new Date("2026-09-25T13:30:00+05:30"),
    priority: 3,
  },
];

async function seed() {
  console.log("Replacing existing schedule with official 24-25 September timeline...");
  await prisma.event.deleteMany();
  for (const item of timeline) {
    await prisma.event.create({
      data: {
        title: item.title,
        description: item.description,
        startTime: item.startTime,
        endTime: item.endTime,
        status: "UPCOMING",
        priority: item.priority,
      },
    });
  }
  const count = await prisma.event.count();
  console.log(`Successfully seeded ${count} timeline events!`);
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
