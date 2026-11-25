const bcrypt = require('bcryptjs');
const db = require('../config/database');
const ragService = require('../services/rag/ragService');
const leadService = require('../services/crm/leadService');
const logger = require('./logger');

const SAMPLE_KNOWLEDGE_DOCS = [
  {
    title: 'Horizon Crest Realty — Company Overview & Projects',
    category: 'Company & Projects',
    industry: 'real-estate',
    sourceType: 'text',
    content: `Horizon Crest Realty is a RERA-registered residential developer operating across Hyderabad and Bengaluru with 12+ delivered gated communities and 4,800+ homeowner families. Our main Experience Center is at Financial District, Nanakramguda, Hyderabad, open daily 10:00 AM to 7:00 PM.

Active Projects:
1. Horizon Crest Skyview (Gachibowli, Hyderabad): 2BHK apartments (1,280–1,410 sq.ft.) priced ₹72 Lakhs–₹84 Lakhs; 3BHK apartments (1,690–1,980 sq.ft.) priced ₹95 Lakhs–₹1.24 Crore. Tower A & B are Ready-to-Move; Tower C possession in December 2026. RERA ID: P02400005182.
2. Horizon Crest Emerald Greens (Kokapet, Hyderabad): 3BHK Corner Suites (1,850–2,150 sq.ft.) priced ₹1.10 Crore–₹1.38 Crore; 4BHK Sky Villas (2,750–3,100 sq.ft.) priced ₹1.75 Crore–₹2.15 Crore. Possession March 2027.
3. Horizon Crest Serenity Villas (Narsingi / Kondapur, Hyderabad): 4BHK Triplex Gated Villas (3,400 sq.ft.) priced ₹2.45 Crore–₹2.95 Crore.
4. Horizon Crest TechPark Enclave (Whitefield, Bengaluru): 2BHK Smart Homes from ₹78 Lakhs; 3BHK Residences from ₹1.12 Crore.`,
  },
  {
    title: 'Amenities, Locations & Connectivity',
    category: 'Amenities & Locations',
    industry: 'real-estate',
    sourceType: 'text',
    content: `Connectivity Highlights:
- Gachibowli & Financial District projects are 8 minutes from Outer Ring Road (ORR) Exit 1, 12 minutes from HITEC City, and near major IT campuses, international schools, and Continental/AIG hospitals.
- Kokapet Emerald Greens connects directly to Neopolis SEZ and Rajiv Gandhi International Airport in 25 minutes via ORR.
- Whitefield TechPark Enclave in Bengaluru is 1.5 km from Hope Farm Metro Station and ITPL.

Community Amenities:
- 35,000 sq.ft. multi-level Clubhouse with temperature-controlled swimming pool, gym, and yoga deck.
- 75% open landscaped green space, traffic-free podium, jogging track, and children's play zone.
- 24/7 three-tier biometric security, CCTV perimeter monitoring, EV charging bays in covered parking, and 100% DG power backup.`,
  },
  {
    title: 'Booking Procedure, Home Loans & Pricing Policy',
    category: 'Booking & Pricing',
    industry: 'real-estate',
    sourceType: 'text',
    content: `Booking Procedure:
1. Schedule a complimentary site visit or live virtual tour with our Senior Property Advisor.
2. Select an available unit and reserve it with a ₹1,00,000 (₹1 Lakh) booking token.
3. Complete KYC and execute the Allotment Agreement within 14 days by paying 10% of the agreement value (inclusive of the ₹1 Lakh token).

Home Loan & Financing:
- Pre-approved by SBI, HDFC Bank, ICICI Bank, and Axis Bank for fast-track 48-hour loan sanction.
- Transparent Cost Sheet: Base price, covered car parking, clubhouse membership, and statutory GST/registration charges are itemized upfront with zero hidden charges.`,
  },
  {
    title: 'Frequently Asked Questions (FAQ)',
    category: 'FAQ',
    industry: 'real-estate',
    sourceType: 'text',
    content: `Frequently Asked Questions:
Q: Is the ₹1,00,000 booking token refundable?
A: Yes, the booking token is 100% refundable if cancelled within 7 days prior to signing the allotment agreement.
Q: Can NRI buyers purchase Horizon Crest properties?
A: Yes, NRI buyers can book via NRE/NRO accounts with dedicated digital Power of Attorney and remote registration assistance.
Q: Are pets allowed in the gated communities?
A: Yes, all Horizon Crest communities are pet-friendly and include designated pet walking zones.
Q: What maintenance warranty is offered after handover?
A: Horizon Crest provides a 5-year structural warranty as per RERA guidelines and 2 years of builder-managed facility operations.`,
  },
];

async function seedDatabase({ force = false } = {}) {
  await db.connect();

  const userCount = await db.users.count();
  if (!force && userCount > 0) {
    return { seeded: false, reason: 'Database already initialized' };
  }

  // 1. Seed Demo & Admin Users (synthetic credentials for MVP demo)
  const existingDemo = await db.users.findByEmail('demo@voxpilot.ai');
  if (!existingDemo) {
    const passwordHash = await bcrypt.hash('VoxPilot@2026', 10);
    await db.users.create({
      name: 'K Sai Vaishnav Kumar (Demo)',
      email: 'demo@voxpilot.ai',
      passwordHash,
      role: 'admin',
      company: 'Horizon Crest Realty',
    });
  }

  // 2. Seed Knowledge Documents if empty
  const existingDocs = await db.knowledge.count();
  if (existingDocs === 0) {
    for (const doc of SAMPLE_KNOWLEDGE_DOCS) {
      await ragService.ingestDocument(doc);
    }
  }

  // 3. Seed Synthetic Demo Leads, Calls, and Appointments if empty
  const existingLeads = await db.leads.count();
  if (existingLeads === 0) {
    const today = new Date();
    const fmtDate = (offsetDays) =>
      new Date(today.getTime() + offsetDays * 86400000).toISOString().split('T')[0];

    const seedLeadsRaw = [
      {
        name: 'Rahul Sharma',
        phone: '9849012345',
        email: 'rahul.sharma@example.com',
        preferredLocation: 'Gachibowli, Hyderabad',
        budget: 9800000,
        budgetLabel: '₹98 Lakhs',
        propertyType: '3BHK',
        purchaseTimeline: 'Within 2 months',
        intent: 'High',
        sentiment: 'Positive',
        qualificationStatus: 'Converted',
        appointmentBooked: true,
        source: 'AI Voice Agent',
        followUpDate: fmtDate(1),
        notes: 'Interested in Skyview Tower B 3BHK facing central park. Scheduled consultation.',
        daysAgo: 3,
      },
      {
        name: 'Ananya Reddy',
        phone: '9885123456',
        email: 'ananya.reddy@example.com',
        preferredLocation: 'Kokapet, Hyderabad',
        budget: 13000000,
        budgetLabel: '₹1.3 Cr',
        propertyType: '3BHK',
        purchaseTimeline: 'Within 3 months',
        intent: 'High',
        sentiment: 'Positive',
        qualificationStatus: 'Qualified',
        appointmentWilling: true,
        source: 'AI Voice Agent',
        followUpDate: fmtDate(2),
        notes: 'Comparing Emerald Greens corner unit; needs HDFC loan pre-check.',
        daysAgo: 2,
      },
      {
        name: 'Vikram Deshmukh',
        phone: '9701234567',
        email: 'vikram.d@example.com',
        preferredLocation: 'Whitefield, Bengaluru',
        budget: 8000000,
        budgetLabel: '₹80 Lakhs',
        propertyType: '2BHK',
        purchaseTimeline: '3-6 months',
        intent: 'Medium',
        sentiment: 'Neutral',
        qualificationStatus: 'Follow-Up',
        source: 'Web Inbound',
        followUpDate: fmtDate(4),
        notes: 'Requested brochure and metro proximity details for TechPark Enclave.',
        daysAgo: 1,
      },
      {
        name: 'Meera Nair',
        phone: '9912345678',
        email: 'meera.nair@example.com',
        preferredLocation: 'Narsingi, Hyderabad',
        budget: 26000000,
        budgetLabel: '₹2.6 Cr',
        propertyType: 'Villa',
        purchaseTimeline: 'Within 1 month',
        intent: 'High',
        sentiment: 'Positive',
        qualificationStatus: 'Qualified',
        appointmentBooked: true,
        source: 'AI Voice Agent',
        followUpDate: fmtDate(1),
        notes: 'Looking for ready/near-possession 4BHK triplex villa with EV charging.',
        daysAgo: 1,
      },
      {
        name: 'Karan Malhotra',
        phone: '9811223344',
        email: 'karan.m@example.com',
        preferredLocation: 'Hyderabad',
        budget: 4500000,
        budgetLabel: '₹45 Lakhs',
        propertyType: '2BHK',
        purchaseTimeline: 'Next year',
        intent: 'Low',
        sentiment: 'Negative',
        qualificationStatus: 'Unqualified',
        source: 'AI Voice Agent',
        followUpDate: fmtDate(14),
        notes: 'Budget below current Gachibowli starting price (₹72L). Keep on nurture list.',
        daysAgo: 0,
      },
    ];

    const createdLeads = [];
    for (const item of seedLeadsRaw) {
      const scoring = leadService.calculateLeadScore({
        name: item.name,
        phone: item.phone,
        email: item.email,
        location: item.preferredLocation,
        budget: item.budget,
        budgetLabel: item.budgetLabel,
        propertyType: item.propertyType,
        purchaseTimeline: item.purchaseTimeline,
        intent: item.intent,
        appointmentWilling: item.appointmentWilling,
        appointmentBooked: item.appointmentBooked,
      });

      const createdAt = new Date(today.getTime() - item.daysAgo * 86400000).toISOString();
      const lead = await db.leads.create({
        ...item,
        leadScore: scoring.leadScore,
        scoreBreakdown: scoring.breakdown,
        qualified: scoring.qualified,
        createdAt,
      });
      createdLeads.push(lead);
    }

    // Seed Calls linked to leads
    const seedCalls = [
      {
        callerName: 'Rahul Sharma',
        callerPhone: '9849012345',
        leadId: createdLeads[0].id,
        language: 'en',
        mode: 'demo',
        status: 'Completed',
        startedAt: new Date(today.getTime() - 3 * 86400000).toISOString(),
        endedAt: new Date(today.getTime() - 3 * 86400000 + 215000).toISOString(),
        durationSeconds: 215,
        sentiment: 'Positive',
        intent: 'High',
        leadScore: createdLeads[0].leadScore,
        qualified: true,
        summary:
          'Rahul Sharma inquired about a 3BHK in Gachibowli with a ₹98 Lakhs budget and a 2-month purchase timeline. He confirmed a site visit consultation.',
        recommendedNextAction:
          'Prepare Skyview Tower B floor plans and cost sheet for consultation.',
        extractedInfo: {
          name: 'Rahul Sharma',
          phone: '9849012345',
          location: 'Gachibowli',
          budget: 9800000,
          budgetLabel: '₹98 Lakhs',
          propertyType: '3BHK',
          purchaseTimeline: 'Within 2 months',
          sentiment: 'Positive',
          intent: 'High',
        },
        transcript: [
          {
            speaker: 'ai',
            text: "Hello! Welcome to our property consultation service. I'm your AI sales assistant. How can I help you find your ideal property today?",
            timestamp: new Date(today.getTime() - 3 * 86400000).toISOString(),
          },
          {
            speaker: 'customer',
            text: 'Hi, my name is Rahul Sharma. I am looking for a 3BHK apartment in Gachibowli with a budget around 98 lakhs.',
            timestamp: new Date(today.getTime() - 3 * 86400000 + 30000).toISOString(),
          },
          {
            speaker: 'ai',
            text: 'Thank you, Rahul! Based on Horizon Crest Skyview in Gachibowli, our 3BHK residences start at ₹95 Lakhs. When are you planning to purchase, and would you like to schedule a site visit?',
            timestamp: new Date(today.getTime() - 3 * 86400000 + 45000).toISOString(),
            retrievedSources: ['Horizon Crest Realty — Company Overview & Projects (Company & Projects)'],
          },
          {
            speaker: 'customer',
            text: 'Within 2 months. Yes, please schedule my visit tomorrow at 11:00 AM. My phone is 9849012345.',
            timestamp: new Date(today.getTime() - 3 * 86400000 + 95000).toISOString(),
          },
        ],
      },
      {
        callerName: 'Ananya Reddy',
        callerPhone: '9885123456',
        leadId: createdLeads[1].id,
        language: 'en',
        mode: 'demo',
        status: 'Completed',
        startedAt: new Date(today.getTime() - 2 * 86400000).toISOString(),
        endedAt: new Date(today.getTime() - 2 * 86400000 + 180000).toISOString(),
        durationSeconds: 180,
        sentiment: 'Positive',
        intent: 'High',
        leadScore: createdLeads[1].leadScore,
        qualified: true,
        summary:
          'Ananya Reddy is seeking a 3BHK corner unit in Kokapet around ₹1.3 Cr within 3 months and asked about HDFC loan support.',
        recommendedNextAction:
          'Share Emerald Greens corner suite availability and HDFC loan advisor contact.',
        extractedInfo: {
          name: 'Ananya Reddy',
          phone: '9885123456',
          location: 'Kokapet',
          budget: 13000000,
          budgetLabel: '₹1.3 Cr',
          propertyType: '3BHK',
          purchaseTimeline: 'Within 3 months',
          sentiment: 'Positive',
          intent: 'High',
        },
        transcript: [
          {
            speaker: 'ai',
            text: "Hello! Welcome to our property consultation service. I'm your AI sales assistant. How can I help you find your ideal property today?",
            timestamp: new Date(today.getTime() - 2 * 86400000).toISOString(),
          },
          {
            speaker: 'customer',
            text: 'I am Ananya Reddy looking for a 3BHK in Kokapet around 1.3 crore within 3 months. Do you support HDFC home loans?',
            timestamp: new Date(today.getTime() - 2 * 86400000 + 40000).toISOString(),
          },
          {
            speaker: 'ai',
            text: 'Yes, Horizon Crest Emerald Greens in Kokapet has 3BHK corner suites from ₹1.10 Cr to ₹1.38 Cr and is pre-approved by HDFC Bank with 48-hour sanction support.',
            timestamp: new Date(today.getTime() - 2 * 86400000 + 55000).toISOString(),
            retrievedSources: ['Booking Procedure, Home Loans & Pricing Policy (Booking & Pricing)'],
          },
        ],
      },
      {
        callerName: 'Meera Nair',
        callerPhone: '9912345678',
        leadId: createdLeads[3].id,
        language: 'en',
        mode: 'demo',
        status: 'Completed',
        startedAt: new Date(today.getTime() - 1 * 86400000).toISOString(),
        endedAt: new Date(today.getTime() - 1 * 86400000 + 240000).toISOString(),
        durationSeconds: 240,
        sentiment: 'Positive',
        intent: 'High',
        leadScore: createdLeads[3].leadScore,
        qualified: true,
        summary:
          'Meera Nair inquired about a 4BHK Villa in Narsingi with a ₹2.6 Cr budget and immediate timeline. Site tour scheduled.',
        recommendedNextAction: 'Assign Luxury Villa Specialist for scheduled tour.',
        extractedInfo: {
          name: 'Meera Nair',
          phone: '9912345678',
          location: 'Narsingi',
          budget: 26000000,
          budgetLabel: '₹2.6 Cr',
          propertyType: 'Villa',
          purchaseTimeline: 'Within 1 month',
          sentiment: 'Positive',
          intent: 'High',
        },
        transcript: [
          {
            speaker: 'ai',
            text: "Hello! Welcome to our property consultation service. I'm your AI sales assistant. How can I help you find your ideal property today?",
            timestamp: new Date(today.getTime() - 1 * 86400000).toISOString(),
          },
          {
            speaker: 'customer',
            text: 'Hello, I am Meera Nair. We want a 4BHK villa in Narsingi around 2.6 crore within 1 month.',
            timestamp: new Date(today.getTime() - 1 * 86400000 + 35000).toISOString(),
          },
        ],
      },
      {
        callerName: 'Karan Malhotra',
        callerPhone: '9811223344',
        leadId: createdLeads[4].id,
        language: 'en',
        mode: 'demo',
        status: 'Completed',
        startedAt: today.toISOString(),
        endedAt: new Date(today.getTime() + 105000).toISOString(),
        durationSeconds: 105,
        sentiment: 'Negative',
        intent: 'Low',
        leadScore: createdLeads[4].leadScore,
        qualified: false,
        summary:
          'Karan Malhotra asked for a 2BHK under ₹45 Lakhs in Hyderabad, which is below current project inventory pricing.',
        recommendedNextAction: 'Add to budget-launch notification list for future affordable towers.',
        extractedInfo: {
          name: 'Karan Malhotra',
          phone: '9811223344',
          location: 'Hyderabad',
          budget: 4500000,
          budgetLabel: '₹45 Lakhs',
          propertyType: '2BHK',
          purchaseTimeline: 'Next year',
          sentiment: 'Negative',
          intent: 'Low',
        },
        transcript: [
          {
            speaker: 'ai',
            text: "Hello! Welcome to our property consultation service. I'm your AI sales assistant. How can I help you find your ideal property today?",
            timestamp: today.toISOString(),
          },
          {
            speaker: 'customer',
            text: 'My budget is 45 lakhs for a 2BHK in Hyderabad, your 72 lakh starting price is too costly for me.',
            timestamp: new Date(today.getTime() + 30000).toISOString(),
          },
        ],
      },
    ];

    for (const c of seedCalls) {
      await db.calls.create(c);
    }

    // Seed Appointments
    await db.appointments.create({
      leadId: createdLeads[0].id,
      customerName: 'Rahul Sharma',
      customerPhone: '9849012345',
      customerEmail: 'rahul.sharma@example.com',
      date: fmtDate(1),
      time: '11:00',
      purpose: '3BHK Skyview Site Visit & Cost Sheet Review',
      location: 'Horizon Crest Skyview, Gachibowli',
      status: 'Scheduled',
      source: 'AI Voice Agent',
    });

    await db.appointments.create({
      leadId: createdLeads[3].id,
      customerName: 'Meera Nair',
      customerPhone: '9912345678',
      customerEmail: 'meera.nair@example.com',
      date: fmtDate(1),
      time: '15:00',
      purpose: '4BHK Serenity Villa Guided Tour',
      location: 'Horizon Crest Serenity Villas, Narsingi',
      status: 'Scheduled',
      source: 'AI Voice Agent',
    });

    await db.appointments.create({
      leadId: createdLeads[1].id,
      customerName: 'Ananya Reddy',
      customerPhone: '9885123456',
      customerEmail: 'ananya.reddy@example.com',
      date: fmtDate(-1),
      time: '16:00',
      purpose: 'Emerald Greens Virtual Floorplan Walkthrough',
      location: 'Video Consultation',
      status: 'Completed',
      source: 'CRM',
    });
  }

  logger.info('Sample database seeding verified/completed.');
  return { seeded: true };
}

if (require.main === module) {
  seedDatabase({ force: true })
    .then((res) => {
      console.log('Seed result:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
