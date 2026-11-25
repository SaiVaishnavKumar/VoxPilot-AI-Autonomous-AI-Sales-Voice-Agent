const LANGUAGES = {
  en: {
    code: 'en',
    label: 'English',
    speechLang: 'en-IN',
    ttsLang: 'en-IN',
    openingGreeting:
      "Hello! Welcome to our property consultation service. I'm your AI sales assistant. How can I help you find your ideal property today?",
  },
  hi: {
    code: 'hi',
    label: 'Hindi (हिन्दी)',
    speechLang: 'hi-IN',
    ttsLang: 'hi-IN',
    openingGreeting:
      'नमस्ते! हमारी प्रॉपर्टी कंसल्टेशन सेवा में आपका स्वागत है। मैं आपका AI सेल्स असिस्टेंट हूँ। आज मैं आपकी आदर्श प्रॉपर्टी खोजने में कैसे मदद कर सकता हूँ?',
  },
};

const INDUSTRY_PROFILES = {
  'real-estate': {
    id: 'real-estate',
    name: 'Real Estate Sales',
    agentRole: 'Senior Real Estate Sales Representative',
    discoveryFields: ['propertyType', 'location', 'budget', 'purchaseTimeline', 'appointment'],
  },
  healthcare: {
    id: 'healthcare',
    name: 'Healthcare Appointments',
    agentRole: 'Patient Care & Appointment Coordinator',
    discoveryFields: ['department', 'preferredDoctor', 'urgency', 'appointment'],
  },
  automobile: {
    id: 'automobile',
    name: 'Automobile Sales',
    agentRole: 'Automotive Sales & Test Drive Advisor',
    discoveryFields: ['vehicleModel', 'fuelType', 'budget', 'purchaseTimeline', 'appointment'],
  },
  education: {
    id: 'education',
    name: 'Education Counselling',
    agentRole: 'Admissions & Program Counsellor',
    discoveryFields: ['program', 'intake', 'budget', 'appointment'],
  },
  'financial-services': {
    id: 'financial-services',
    name: 'Financial Services',
    agentRole: 'Wealth & Loan Advisory Assistant',
    discoveryFields: ['productType', 'investmentAmount', 'timeline', 'appointment'],
  },
};

function getLanguageConfig(lang = 'en') {
  return LANGUAGES[lang] || LANGUAGES.en;
}

function getIndustryProfile(industry = 'real-estate') {
  return INDUSTRY_PROFILES[industry] || INDUSTRY_PROFILES['real-estate'];
}

module.exports = {
  LANGUAGES,
  INDUSTRY_PROFILES,
  getLanguageConfig,
  getIndustryProfile,
};
