export type CropsBundle = {
  eyebrow: string;
  title: string;
  description: string;
  nav: string;
  form: {
    farmLabel: string;
    seasonLabel: string;
    yearLabel: string;
    soilLabel: string;
    irrigationLabel: string;
    budgetLabel: string;
    soilOther: string;
    submit: string;
    submitting: string;
    lowestViableWarning: string;
    switchBracket: string;
    noFarm: string;
    geoError: string;
    regionalSoilNote: string;
    nationalSoilNote: string;
  };
  seasons: {
    summer: string;
    winter: string;
    autumn: string;
    spring: string;
    rainy: string;
    windy: string;
  };
  soil: {
    sandy: string;
    sandy_loam: string;
    loamy: string;
    clay_loam: string;
    clay: string;
    silty: string;
    saline: string;
    rocky: string;
    other: string;
  };
  budget: {
    low: string;
    medium: string;
    high: string;
    very_high: string;
  };
  irrigation: {
    rainfed: string;
    canal: string;
    tubewell: string;
    mixed: string;
  };
  results: {
    title: string;
    rank: string;
    revenue: string;
    reason: string;
    risks: string;
    saveToPlan: string;
    saved: string;
    compare: string;
    projectionNote: string;
    sourceWeather: string;
    sourceMarket: string;
    sourceSoil: string;
    weatherMissing: string;
    marketMissing: string;
    soilMissing: string;
    regenerate: string;
    regenerateConfirm: string;
    alreadyExists: string;
    viewExisting: string;
    noCandidates: string;
    replacedPlan: string;
  };
  detail: {
    title: string;
    back: string;
    confidence: string;
    scoreBreakdown: string;
    suitability: string;
    weatherFit: string;
    profitability: string;
    risk: string;
    sustainability: string;
    final: string;
    dataFreshness: string;
    soilImpact: string;
  };
  water: {
    low: string;
    medium: string;
    high: string;
  };
  confidence: {
    high: string;
    medium: string;
    low: string;
    unreliable: string;
  };
  risk: {
    price_volatility: string;
    pest_pressure: string;
    weather: string;
    water_stress: string;
    input_cost: string;
  };
  soilImpact: {
    improves: string;
    neutral: string;
    depletes: string;
  };
  compare: {
    title: string;
    close: string;
    revenue: string;
    duration: string;
    water: string;
    marketRisk: string;
    soilImpact: string;
    labour: string;
    chartAria: string;
    chartUnavailable: string;
    selectToSave: string;
    saveSelected: string;
  };
  rotation: {
    title: string;
    subtitle: string;
    generic: string;
    nextSeason: string;
    savedTitle: string;
  };
  savedPlans: {
    title: string;
    empty: string;
    farm: string;
    season: string;
    year: string;
    crop: string;
    updated: string;
    viewPlan: string;
  };
  catalogue: {
    empty: string;
  };
  errors: {
    serviceUnavailable: string;
    generic: string;
    dataUnavailable: string;
    notFound: string;
    rateLimited: string;
  };
  reason: {
    suitability: string;
    weather_fit: string;
    profit: string;
    rotation_fit: string;
    low_risk: string;
    generic: string;
  };
  rotationKeys: {
    wheat_then_mung: string;
    wheat_then_chickpea: string;
    wheat_then_cotton: string;
    cotton_then_wheat: string;
    cotton_then_maize: string;
    rice_then_wheat: string;
    rice_then_maize: string;
    maize_then_potato: string;
    maize_then_wheat: string;
    potato_then_maize: string;
    sugarcane_then_maize: string;
    mung_then_wheat: string;
    chickpea_then_cotton: string;
    mustard_then_cotton: string;
    soybean_then_wheat: string;
    onion_then_maize: string;
    tomato_then_wheat: string;
    barley_then_chickpea: string;
    bajra_then_cowpea: string;
    sunflower_then_wheat: string;
    canola_then_wheat: string;
    lentil_then_cotton: string;
    pea_then_maize: string;
    cauliflower_then_pea: string;
    okra_then_cowpea: string;
    garlic_then_wheat: string;
  };
};
