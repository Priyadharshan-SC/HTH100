const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Default Admin
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@hth.com' },
    update: {},
    create: {
      email: 'admin@hth.com',
      password: 'password123', // In a real app, this MUST be hashed
    },
  });
  
  console.log("Admin seeded:", admin.email);

  // Clear existing events for fresh demo
  await prisma.event.deleteMany({});
  console.log("Cleared existing events");

  // Create initial events
  const today = new Date();
  
  // Tomorrow at 9:30 AM
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  // Registration 9:30 AM
  const regStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 9, 30, 0);
  const regEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10, 30, 0);

  // Opening 10:30 AM
  const openStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10, 30, 0);
  const openEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 11, 30, 0);

  // Hacking 11:30 AM
  const hackStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 11, 30, 0);
  const hackEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 18, 0, 0);

  const events = [
    {
      title: "Registration & Breakfast",
      description: "Welcome to Hack The Horizon 2.0!",
      startTime: regStart,
      endTime: regEnd,
      status: "UPCOMING",
      priority: 1
    },
    {
      title: "Opening Ceremony",
      description: "Keynotes and theme reveal",
      startTime: openStart,
      endTime: openEnd,
      status: "UPCOMING",
      priority: 2
    },
    {
      title: "Hacking Begins",
      description: "Code Today. Create Tomorrow.",
      startTime: hackStart,
      endTime: hackEnd,
      status: "UPCOMING",
      priority: 3
    }
  ];

  for (const event of events) {
    await prisma.event.create({ data: event });
  }

  console.log("Seeded", events.length, "events");

  // Seed Exactly 13 Physical Venues
  const venues = [
    { venueCode: "VENUE-01", venueName: "Main Auditorium", displayName: "Auditorium Main Screen", trackName: "General / Keynotes", status: "ONLINE" },
    { venueCode: "VENUE-02", venueName: "Seminar Hall 1", displayName: "Seminar Hall 1 Display", trackName: "AI & Machine Learning Track", status: "ONLINE" },
    { venueCode: "VENUE-03", venueName: "Seminar Hall 2", displayName: "Seminar Hall 2 Display", trackName: "Cybersecurity & Cloud Track", status: "ONLINE" },
    { venueCode: "VENUE-04", venueName: "Innovation Lab A", displayName: "Lab A Smart Board", trackName: "Robotics & IoT Track", status: "ONLINE" },
    { venueCode: "VENUE-05", venueName: "Innovation Lab B", displayName: "Lab B Smart Board", trackName: "Web3 & Blockchain Track", status: "ONLINE" },
    { venueCode: "VENUE-06", venueName: "Mechanical Seminar Hall", displayName: "Mech Hall Display", trackName: "Smart Automation Track", status: "ONLINE" },
    { venueCode: "VENUE-07", venueName: "CSE Smart Hub", displayName: "CSE Hub Screen", trackName: "Open Innovation Track", status: "ONLINE" },
    { venueCode: "VENUE-08", venueName: "IT Conference Hall", displayName: "IT Conf Display", trackName: "FinTech Track", status: "ONLINE" },
    { venueCode: "VENUE-09", venueName: "AI & Data Science Center", displayName: "AI Center Screen", trackName: "Healthcare AI Track", status: "ONLINE" },
    { venueCode: "VENUE-10", venueName: "Central Research Lab", displayName: "Research Lab Screen", trackName: "CleanTech & Sustainability", status: "ONLINE" },
    { venueCode: "VENUE-11", venueName: "Design Thinking Studio", displayName: "Design Studio Screen", trackName: "UI/UX & Design Track", status: "ONLINE" },
    { venueCode: "VENUE-12", venueName: "Incubation Centre", displayName: "Incubation Hall Display", trackName: "Startup & Enterprise Track", status: "ONLINE" },
    { venueCode: "VENUE-13", venueName: "Valedictory Hall", displayName: "Valedictory Screen", trackName: "Final Review & Demos", status: "ONLINE" },
  ];

  for (const v of venues) {
    await prisma.venue.upsert({
      where: { venueCode: v.venueCode },
      update: {
        venueName: v.venueName,
        displayName: v.displayName,
        trackName: v.trackName,
      },
      create: v,
    });
  }

  console.log("Seeded 13 venues successfully.");

  // Seed Default Display Configuration
  await prisma.displayConfig.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      showCountdown: true,
      showSchedule: true,
      showAlertCentre: true,
      showLogo: true,
      customAnnouncement: "",
    },
  });

  console.log("Display configuration initialized.");
  console.log("Database seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
