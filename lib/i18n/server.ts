import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { CATALOG, ENGLISH_TABLE, type CatalogKey } from "@/catalog";
import { APP_LOCALE_COOKIE, isLocale } from "./config";
import { query } from "@/lib/db";
import { requireSessionApi } from "@/lib/auth/guards";

import type { Locale } from "./config";
import { formatMessage } from "./logic";
import { resolveAppLocale, resolveString, type ResolvedString, type StringTable } from "./logic";
import type { DashboardBundle } from "@/app/(farmer)/(dashboard)/dashboard/dashboard-bundle";
import type { FarmsBundle } from "@/app/(farmer)/(dashboard)/farms/farms-bundle";
import type { AdvisorBundle } from "@/app/(farmer)/(dashboard)/advisor/advisor-bundle";
import type { DetectBundle } from "@/app/(farmer)/(dashboard)/detect/detect-bundle";
import type { WeatherBundle } from "@/app/(farmer)/(dashboard)/weather/weather-bundle";
import type { PricesBundle } from "@/app/(farmer)/(dashboard)/prices/prices-bundle";
import type { CropsBundle } from "@/app/(farmer)/(dashboard)/crops/crops-bundle";

export interface Translator {
  (key: CatalogKey, params?: Readonly<Record<string, string | number>>): ResolvedString;
}

export interface Dictionary {
  locale: Locale;
  t: Translator;
}

function buildTable(
  rows: readonly { key: string; value: string | null }[],
): StringTable {
  const table: Record<string, string> = {};
  for (const row of rows) {
    if (typeof row.value === "string" && row.value.trim() !== "") {
      table[row.key] = row.value;
    }
  }
  return table;
}

/**
 * Loads the dictionary for one locale from the DB catalog. Rendered
 * dynamically with per-request dedupe via React cache() ΓÇö no cross-request
 * cache, so founder SQL edits are visible on the very next request (AC-6).
 * If Supabase is unreachable we degrade to the build-time catalog so pages
 * still render English (+ drafted copy) instead of erroring.
 */
export const getDictionary = cache(async (localeCode: Locale): Promise<Dictionary> => {
  let primary: StringTable = fallbackTableFor(localeCode);
  let english: StringTable = ENGLISH_TABLE;

  try {
    const rows = await query<{ key: string; locale: string; value: string | null }>(
      `SELECT key, locale, value FROM translations
       WHERE locale = ANY($1) AND status = 'translated'`,
      [[localeCode, "en"]]
    );

    const localizedRows: { key: string; value: string | null }[] = [];
    const englishRows: { key: string; value: string | null }[] = [];
    for (const row of rows) {
      if (row.locale === localeCode) localizedRows.push(row);
      else englishRows.push(row);
    }
    // DB rows overlay the drafted baseline ΓÇö they can override copy but a
    // missing/empty DB (or locale gap) must never erase the catalog.
    primary = {
      ...fallbackTableFor(localeCode),
      ...buildTable(localizedRows),
    };
    const dbEnglish = buildTable(englishRows);
    english = { ...ENGLISH_TABLE, ...dbEnglish };
  } catch {
    // Database unavailable ΓÇö keep the build-time fallback tables.
  }

  const t: Translator = (key, params) => {
    const resolved = resolveString(primary, english, key);
    const text =
      params === undefined ? resolved.text : formatMessage(resolved.text, params);
    return { text, isFallback: resolved.isFallback };
  };

  return { locale: localeCode, t };
});

/** Build-time drafted copy for a locale merged over the English source of truth. */
export function fallbackTableFor(localeCode: Locale): StringTable {
  const drafted = CATALOG[localeCode] ?? {};
  const table: Record<string, string> = { ...ENGLISH_TABLE };
  for (const [key, value] of Object.entries(drafted)) {
    if (typeof value === "string" && value.trim() !== "") table[key] = value;
  }
  return table;
}

/**
 * Dictionary for whichever locale the URL carries ΓÇö the standard entry point
 * for pages under app/[locale]. Unprefixed rewrites resolve to "en".
 * Accepts an explicit locale override so callers can pass `params.locale`
 * instead of relying on `next/root-params` (which is unavailable in this
 * Next.js version).
 */
export async function getCurrentDictionary(
  locale?: Locale,
): Promise<Dictionary> {
  const raw = locale ?? (await getAppLocale());
  return getDictionary(isLocale(raw) ? raw : "en");
}

/**
 * Farmer-app display language, resolved once per request from the persisted
 * preference (ADR 0004): absent/unknown cookie values fall back to English.
 * Cached like getDictionary so a layout and its pages share one resolution.
 */
export const getAppLocale = cache(async (): Promise<Locale> => {
  await connection();
  const cookieStore = await cookies();
  return resolveAppLocale(cookieStore.get(APP_LOCALE_COOKIE)?.value);
});

/**
 * Unread weather-alert count for the shell badge. Never throws ΓÇö a missing
 * table or unavailable DB simply yields zero so the shell always renders.
 */
async function getUnreadAlertCount(): Promise<number> {
  try {
    const session = await requireSessionApi();
    if (!session) return 0;
    const rows = await query<{ count: number }>(
      `SELECT count(*)::int AS count FROM weather_alerts
       WHERE account_id = $1 AND read_at IS NULL AND dismissed_at IS NULL`,
      [session.accountId],
    );
    return Number(rows?.[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Flat translation bundle for the client shell (sidebar + bottom tabs).
 * Server-only function ΓÇö result crosses the RSC boundary as plain props.
 */
export async function getShellBundle() {
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.t;
  return {
    nav: {
      dashboard: t("app.shell.nav.dashboard").text,
      farms: t("app.shell.nav.farms").text,
      profitLoss: t("app.shell.nav.profitLoss").text,
      advisor: t("app.shell.nav.advisor").text,
      detect: t("app.shell.nav.detect").text,
      crops: t("app.shell.nav.crops").text,
      prices: t("app.shell.nav.prices").text,
      weather: t("app.shell.nav.weather").text,
      notifications: t("app.shell.nav.notifications").text,
      settings: t("app.shell.nav.settings").text,
      more: t("app.shell.nav.more").text,
    },
    signOut: t("app.shell.signOut").text,
    aria: {
      farmerTools: t("app.shell.aria.farmerTools").text,
      currentPage: t("app.shell.aria.currentPage").text,
    },
    productOf: t("common.productOfAplinode").text,
    builtForPakistan: t("common.builtForPakistan").text,
    alertsUnread: await getUnreadAlertCount(),
  } as const;
}

/**
 * Flat translation bundle for the client DashboardView (UI chrome + demo data).
 * Server-only function ΓÇö result crosses the RSC boundary as plain props.
 */
export async function getDashboardBundle(): Promise<DashboardBundle> {
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.t;
  return {
    greeting: t("app.dashboard.greeting").text,
    profileMenu: t("app.dashboard.aria.profileMenu").text,
    welcomeEyebrow: t("app.dashboard.welcomeEyebrow").text,
    welcomeTitle: t("app.dashboard.welcomeTitle").text,
    welcomeBody: t("app.dashboard.welcomeBody").text,
    addFirstFarm: t("app.dashboard.addFirstFarm").text,
    today: t("app.dashboard.badge.today").text,
    advisoryTitle: t("app.dashboard.aria.advisoryTitle").text,
    carryToField: t("app.dashboard.carryToField").text,
    askAdvisor: t("app.dashboard.askAdvisor").text,
    weatherTitle: t("app.dashboard.aria.weatherTitle").text,
    degreesCelsius: t("app.dashboard.aria.degreesCelsius").text,
    fullForecast: t("app.dashboard.fullForecast").text,
    weatherUnavailable: t("app.dashboard.weatherUnavailable").text,
    seasonTipBadge: t("app.dashboard.seasonTipBadge").text,
    alertsHeading: t("app.dashboard.alertsHeading").text,
    newCount: t("app.dashboard.newCount").text,
    viewAllAlerts: t("app.dashboard.viewAllAlerts").text,
    noAlerts: t("app.dashboard.noAlerts").text,
    alertAria: t("app.dashboard.aria.alert").text,
    severityCritical: t("app.dashboard.severity.critical").text,
    severityWatch: t("app.dashboard.severity.watch").text,
    severityInfo: t("app.dashboard.severity.info").text,
    quickActionsHeading: t("app.dashboard.quickActionsHeading").text,
    cropDoctor: t("app.dashboard.cropDoctor").text,
    detectTitle: t("app.dashboard.detectTitle").text,
    detectBody: t("app.dashboard.detectBody").text,
    recommendCrops: t("app.dashboard.recommendCrops").text,
    recommendCropsBody: t("app.dashboard.recommendCropsBody").text,
    myFarms: t("app.dashboard.myFarms").text,
    addFarm: t("app.dashboard.addFarm").text,
    viewAllFarms: t("app.dashboard.viewAllFarms").text,
    healthGood: t("app.dashboard.health.good").text,
    healthWatch: t("app.dashboard.health.watch").text,
    setupChecklist: t("app.dashboard.setupChecklist").text,
    checklistProgress: t("app.dashboard.checklistProgress").text,
    dismissChecklist: t("app.dashboard.aria.dismissChecklist").text,
    setupProgress: t("app.dashboard.aria.setupProgress").text,
    demoFooter: t("app.dashboard.demoFooter").text,
    pricesWidgetTitle: t("app.dashboard.pricesWidgetTitle").text,
    pricesWidgetView: t("app.dashboard.pricesWidgetView").text,
    pricesWidgetPerMaund: t("app.dashboard.pricesWidgetPerMaund").text,
    pricesWidgetNoTracked: t("app.dashboard.pricesWidgetNoTracked").text,
    languageLabel: t("app.dashboard.languageLabel").text,
    signOut: t("app.shell.signOut").text,
    weatherNoLocation: t("app.dashboard.weatherNoLocation").text,
    weatherYourArea: t("app.dashboard.weatherYourArea").text,
    demo: {
      todayLabel: t("app.dashboard.demo.todayLabel").text,
      location: t("app.dashboard.demo.location").text,
      advisoryCrop: t("app.dashboard.demo.advisoryCrop").text,
      advisoryStage: t("app.dashboard.demo.advisoryStage").text,
      advisoryAction: t("app.dashboard.demo.advisoryAction").text,
      advisoryWhy: t("app.dashboard.demo.advisoryWhy").text,
      seasonAction: t("app.dashboard.demo.seasonAction").text,
      seasonWhy: t("app.dashboard.demo.seasonWhy").text,
      weatherLocation: t("app.dashboard.demo.weatherLocation").text,
      weatherCondition: t("app.dashboard.demo.weatherCondition").text,
      rainNote: t("app.dashboard.demo.rainNote").text,
      alertWhitefly: t("app.dashboard.demo.alertWhitefly").text,
      alertRain: t("app.dashboard.demo.alertRain").text,
      alertPrice: t("app.dashboard.demo.alertPrice").text,
      farm1Name: t("app.dashboard.demo.farm1Name").text,
      farm1Location: t("app.dashboard.demo.farm1Location").text,
      farm1Crops: t("app.dashboard.demo.farm1Crops").text,
      farm1Stage: t("app.dashboard.demo.farm1Stage").text,
      farm2Name: t("app.dashboard.demo.farm2Name").text,
      farm2Location: t("app.dashboard.demo.farm2Location").text,
      farm2Crops: t("app.dashboard.demo.farm2Crops").text,
      farm2Stage: t("app.dashboard.demo.farm2Stage").text,
      farm3Name: t("app.dashboard.demo.farm3Name").text,
      farm3Location: t("app.dashboard.demo.farm3Location").text,
      farm3Crops: t("app.dashboard.demo.farm3Crops").text,
      farm3Stage: t("app.dashboard.demo.farm3Stage").text,
      checklistAdvisor: t("app.dashboard.demo.checklistAdvisor").text,
      checklistDetect: t("app.dashboard.demo.checklistDetect").text,
      actionAdvisor: t("app.dashboard.demo.actionAdvisor").text,
      actionScan: t("app.dashboard.demo.actionScan").text,
      actionPrices: t("app.dashboard.demo.actionPrices").text,
      actionRecord: t("app.dashboard.demo.actionRecord").text,
      actionRecommend: t("app.dashboard.demo.actionRecommend").text,
    },
  };
}

/**
 * Flat translation bundle for the farms feature (list, new, detail, records).
 * Built server-side and passed as props to client components.
 */
export async function getFarmsBundle(): Promise<FarmsBundle> {
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.t;
  return {
    eyebrow: t("app.farms.eyebrow").text,
    healthGood: t("app.farms.health.good").text,
    healthWatch: t("app.farms.health.watch").text,
    unitsAcres: t("app.farms.units.acres").text,
    stages: {
      sowing: t("app.farms.stages.sowing").text,
      tillering: t("app.farms.stages.tillering").text,
      vegetative: t("app.farms.stages.vegetative").text,
      grainFilling: t("app.farms.stages.grainFilling").text,
      ready: t("app.farms.stages.ready").text,
      squaring: t("app.farms.stages.squaring").text,
      flowering: t("app.farms.stages.flowering").text,
      bollFilling: t("app.farms.stages.bollFilling").text,
      grandGrowth: t("app.farms.stages.grandGrowth").text,
      ripening: t("app.farms.stages.ripening").text,
      harvest: t("app.farms.stages.harvest").text,
      panicleInitiation: t("app.farms.stages.panicleInitiation").text,
    },
    districts: {
      multan: t("app.farms.districts.multan").text,
      sahiwal: t("app.farms.districts.sahiwal").text,
      faisalabad: t("app.farms.districts.faisalabad").text,
      vehari: t("app.farms.districts.vehari").text,
      bahawalpur: t("app.farms.districts.bahawalpur").text,
      lodhran: t("app.farms.districts.lodhran").text,
    },
    crops: {
      wheat: t("app.farms.crops.wheat").text,
      cotton: t("app.farms.crops.cotton").text,
      sugarcane: t("app.farms.crops.sugarcane").text,
      maize: t("app.farms.crops.maize").text,
      rice: t("app.farms.crops.rice").text,
    },
    list: {
      pageTitle: t("app.farms.list.pageTitle").text,
      heading: t("app.farms.list.heading").text,
      description: t("app.farms.list.description").text,
      addLink: t("app.farms.list.addLink").text,
      openFarm: t("app.farms.list.openFarm").text,
      addNewFarm: t("app.farms.list.addNewFarm").text,
      emptyHeading: t("app.farms.list.emptyHeading").text,
    },
    new: {
      pageTitle: t("app.farms.new.pageTitle").text,
      heading: t("app.farms.new.heading").text,
      description: t("app.farms.new.description").text,
      fields: {
        name: t("app.farms.new.fields.name").text,
        district: t("app.farms.new.fields.district").text,
        crop: t("app.farms.new.fields.crop").text,
        acres: t("app.farms.new.fields.acres").text,
        location: t("app.farms.new.fields.location").text,
        primaryCrop: t("app.farms.new.fields.primaryCrop").text,
        sowingDate: t("app.farms.new.fields.sowingDate").text,
        soilType: t("app.farms.new.fields.soilType").text,
        irrigationMethod: t("app.farms.new.fields.irrigationMethod").text,
      },
      placeholders: {
        name: t("app.farms.new.placeholders.name").text,
        district: t("app.farms.new.placeholders.district").text,
        crop: t("app.farms.new.placeholders.crop").text,
        acres: t("app.farms.new.placeholders.acres").text,
        location: t("app.farms.new.placeholders.location").text,
        soilType: t("app.farms.new.placeholders.soilType").text,
      },
      buttons: {
        saving: t("app.farms.new.buttons.saving").text,
        save: t("app.farms.new.buttons.save").text,
      },
      demoNotice: t("app.farms.new.demoNotice").text,
      success: {
        heading: t("app.farms.new.success.heading").text,
        description: t("app.farms.new.success.description").text,
        goToFarms: t("app.farms.new.success.goToFarms").text,
        backToDashboard: t("app.farms.new.success.backToDashboard").text,
      },
      errors: {
        nameRequired: t("app.farms.new.errors.nameRequired").text,
        districtRequired: t("app.farms.new.errors.districtRequired").text,
        cropRequired: t("app.farms.new.errors.cropRequired").text,
        acresRequired: t("app.farms.new.errors.acresRequired").text,
      },
    },
    detail: {
      pageTitle: t("app.farms.detail.pageTitle").text,
      heroEyebrow: t("app.farms.detail.heroEyebrow").text,
      goodHealth: t("app.farms.detail.goodHealth").text,
      needsWatching: t("app.farms.detail.needsWatching").text,
      sownLabel: t("app.farms.detail.sownLabel").text,
      seasonHeading: t("app.farms.detail.seasonHeading").text,
      activityHeading: t("app.farms.detail.activityHeading").text,
      viewAllRecords: t("app.farms.detail.viewAllRecords").text,
      logFieldEvent: t("app.farms.detail.logFieldEvent").text,
      scanCrop: t("app.farms.detail.scanCrop").text,
      noRecords: t("app.farms.detail.noRecords").text,
    },
    records: {
      eyebrow: t("app.records.eyebrow").text,
      types: {
        irrigation: t("app.records.types.irrigation").text,
        fertilizer: t("app.records.types.fertilizer").text,
        pesticide: t("app.records.types.pesticide").text,
        disease: t("app.records.types.disease").text,
        harvest: t("app.records.types.harvest").text,
      },
      noRecordsFound: t("app.records.noRecordsFound").text,
      farmRecords: {
        pageTitle: t("app.records.farmRecords.pageTitle").text,
        heading: t("app.records.farmRecords.heading").text,
        description: t("app.records.farmRecords.description").text,
        demoNotice: t("app.records.farmRecords.demoNotice").text,
      },
      new: {
        pageTitle: t("app.records.new.pageTitle").text,
        heading: t("app.records.new.heading").text,
        description: t("app.records.new.description").text,
        fields: {
          type: t("app.records.new.fields.type").text,
          farm: t("app.records.new.fields.farm").text,
          date: t("app.records.new.fields.date").text,
          title: t("app.records.new.fields.title").text,
          optional: t("app.records.new.fields.optional").text,
          details: t("app.records.new.fields.details").text,
        },
        placeholders: {
          farm: t("app.records.new.placeholders.farm").text,
          titleIrrigation: t("app.records.new.placeholders.titleIrrigation").text,
          titleOther: t("app.records.new.placeholders.titleOther").text,
          details: t("app.records.new.placeholders.details").text,
        },
        buttons: {
          saving: t("app.records.new.buttons.saving").text,
          save: t("app.records.new.buttons.save").text,
        },
        demoNotice: t("app.records.new.demoNotice").text,
        success: {
          heading: t("app.records.new.success.heading").text,
          description: t("app.records.new.success.description").text,
          backToDashboard: t("app.records.new.success.backToDashboard").text,
          viewFarms: t("app.records.new.success.viewFarms").text,
        },
        errors: {
          farmRequired: t("app.records.new.errors.farmRequired").text,
          dateRequired: t("app.records.new.errors.dateRequired").text,
        },
      },
    },
  };
}

/**
 * Flat translation bundle for the advisor chat feature (sidebar + chat UI).
 * Built server-side and passed as props to client components.
 */
export async function getAdvisorBundle(): Promise<AdvisorBundle> {
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.t;
  return {
    pageTitle: t("app.advisor.pageTitle").text,
    sidebar: {
      title: t("app.advisor.sidebar.title").text,
      newConversation: t("app.advisor.sidebar.newConversation").text,
      noConversations: t("app.advisor.sidebar.noConversations").text,
      rename: t("app.advisor.sidebar.rename").text,
      delete: t("app.advisor.sidebar.delete").text,
      deleteTitle: t("app.advisor.sidebar.deleteTitle").text,
      deleteConfirm: t("app.advisor.sidebar.deleteConfirm").text,
      cancel: t("app.advisor.sidebar.cancel").text,
      closeSidebar: t("app.advisor.sidebar.closeSidebar").text,
    },
    chat: {
      placeholder: t("app.advisor.chat.placeholder").text,
      send: t("app.advisor.chat.send").text,
      thinking: t("app.advisor.chat.thinking").text,
      openingGreeting: t("app.advisor.chat.openingGreeting").text,
      photoRedirect: t("app.advisor.chat.photoRedirect").text,
      nonFarmingRedirect: t("app.advisor.chat.nonFarmingRedirect").text,
      tryAsking: t("app.advisor.chat.tryAsking").text,
      suggested1: t("app.advisor.chat.suggested1").text,
      suggested2: t("app.advisor.chat.suggested2").text,
      suggested3: t("app.advisor.chat.suggested3").text,
      suggested4: t("app.advisor.chat.suggested4").text,
      emptyEyebrow: t("app.advisor.chat.emptyEyebrow").text,
      emptyTitle: t("app.advisor.chat.emptyTitle").text,
      emptyBody: t("app.advisor.chat.emptyBody").text,
      onlineStatus: t("app.advisor.chat.onlineStatus").text,
      typing: t("app.advisor.chat.typing").text,
      composerHint: t("app.advisor.chat.composerHint").text,
      farmerYou: t("app.advisor.chat.farmerYou").text,
    },
    errors: {
      serviceUnavailable: t("app.advisor.errors.serviceUnavailable").text,
      rateLimited: t("app.advisor.errors.rateLimited").text,
      network: t("app.advisor.errors.network").text,
      generic: t("app.advisor.errors.generic").text,
    },
    aria: {
      openSidebar: t("app.advisor.aria.openSidebar").text,
      sendMessage: t("app.advisor.aria.sendMessage").text,
      chatMessages: t("app.advisor.aria.chatMessages").text,
    },
  };
}

/**
 * Flat translation bundle for the detect / crop-doctor feature.
 * Built server-side and passed as props to the client DetectUpload.
 */
export async function getDetectBundle(): Promise<DetectBundle> {
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.t;
  return {
    eyebrow: t("app.detect.eyebrow").text,
    title: t("app.detect.title").text,
    description: t("app.dashboard.detectBody").text,
    uploadPrompt: t("app.detect.uploadPrompt").text,
    takePhoto: t("app.detect.takePhoto").text,
    sampleScan: t("app.detect.sampleScan").text,
    readingLeaf: t("app.detect.readingLeaf").text,
    analyzing: t("app.detect.analyzing").text,
    scanAnother: t("app.detect.scanAnother").text,
    discussAdvisor: t("app.detect.discussAdvisor").text,
    saveToFarm: t("app.detect.saveToFarm").text,
    savedToFarm: t("app.detect.savedToFarm").text,
    notSaved: t("app.detect.notSaved").text,
    confidence: t("app.detect.confidence").text,
    whatToDo: t("app.detect.whatToDo").text,
    caution: t("app.detect.caution").text,
    noFarmsTitle: t("app.detect.noFarmsTitle").text,
    noFarmsBody: t("app.detect.noFarmsBody").text,
    addFarm: t("app.detect.addFarm").text,
    dismiss: t("app.detect.dismiss").text,
    pastScans: t("app.detect.pastScans").text,
    loadMore: t("app.detect.loadMore").text,
    invalidFile: t("app.detect.invalidFile").text,
    serviceUnavailable: t("app.detect.serviceUnavailable").text,
    noDiagnosis: t("app.detect.noDiagnosis").text,
    retry: t("app.detect.retry").text,
    savedStatus: t("app.detect.savedStatus").text,
    unsavedStatus: t("app.detect.unsavedStatus").text,
    dragDropPrompt: t("app.detect.dragDropPrompt").text,
    dragDropPromptLine1: t("app.detect.dragDropPromptLine1").text,
    dragDropPromptLine2: t("app.detect.dragDropPromptLine2").text,
    historyEmpty: t("app.detect.historyEmpty").text,
    linkToFarm: t("app.detect.linkToFarm").text,
    severity: {
      watch: t("app.detect.severity.watch").text,
      treatNow: t("app.detect.severity.treatNow").text,
      clear: t("app.detect.severity.clear").text,
    },
    chat: {
      newScan: t("app.detect.chat.newScan").text,
      placeholder: t("app.detect.chat.placeholder").text,
      send: t("app.detect.chat.send").text,
      thinking: t("app.detect.chat.thinking").text,
      imagePreview: t("app.detect.chat.imagePreview").text,
      closePreview: t("app.detect.chat.closePreview").text,
      emptyState: t("app.detect.chat.emptyState").text,
      sessionsTitle: t("app.detect.chat.sessionsTitle").text,
      noSessions: t("app.detect.chat.noSessions").text,
      deleteSession: t("app.detect.chat.deleteSession").text,
      deleteConfirm: t("app.detect.chat.deleteConfirm").text,
      cancel: t("app.detect.chat.cancel").text,
    },
    sidebar: {
      title: t("app.detect.sidebar.title").text,
      newScan: t("app.detect.sidebar.newScan").text,
      closeSidebar: t("app.detect.sidebar.closeSidebar").text,
      noHistory: t("app.detect.sidebar.noHistory").text,
      scansTitle: t("app.detect.sidebar.scansTitle").text,
      chatsTitle: t("app.detect.sidebar.chatsTitle").text,
    },
  };
}

/**
 * Flat translation bundle for the weather advisory feature (server chrome).
 * Per-day advice and per-alert recommendation are resolved dynamically from the
 * dictionary in the page (their keys are data-driven), so only fixed chrome and
 * enum labels live here.
 */
export async function getWeatherBundle(): Promise<WeatherBundle> {
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.t;
  return {
    pageTitle: t("app.weather.pageTitle").text,
    eyebrow: t("app.weather.eyebrow").text,
    description: t("app.weather.description").text,
    todayAdvisory: t("app.weather.todayAdvisory").text,
    growthStage: t("app.weather.growthStage").text,
    severity: {
      info: t("app.weather.severity.info").text,
      warning: t("app.weather.severity.warning").text,
      critical: t("app.weather.severity.critical").text,
    },
    forecastTitle: t("app.weather.forecastTitle").text,
    forecastSubtitle: t("app.weather.forecastSubtitle").text,
    weatherUnavailable: t("app.weather.weatherUnavailable").text,
    weatherUnavailableBody: t("app.weather.weatherUnavailableBody").text,
    farmSelectorLabel: t("app.weather.farmSelectorLabel").text,
    registerTitle: t("app.weather.registerTitle").text,
    registerBody: t("app.weather.registerBody").text,
    registerCta: t("app.weather.registerCta").text,
    registerForm: {
      title: t("app.weather.registerTitle").text,
      body: t("app.weather.registerBody").text,
      crop: t("app.weather.registerForm.crop").text,
      sowing: t("app.weather.registerForm.sowing").text,
      soil: t("app.weather.registerForm.soil").text,
      irrigation: t("app.weather.registerForm.irrigation").text,
      soilTypes: t("app.weather.registerForm.soilTypes").text,
      irrigationMethods: t("app.weather.registerForm.irrigationMethods").text,
      save: t("app.weather.registerForm.save").text,
      saving: t("app.weather.registerForm.saving").text,
      success: t("app.weather.registerForm.success").text,
      error: t("app.weather.registerForm.error").text,
    },
    metric: {
      temperature: t("app.weather.metric.temperature").text,
      precipitation: t("app.weather.metric.precipitation").text,
      wind: t("app.weather.metric.wind").text,
      humidity: t("app.weather.metric.humidity").text,
    },
    historyTitle: t("app.weather.historyTitle").text,
    historySubtitle: t("app.weather.historySubtitle").text,
    historyEmpty: t("app.weather.history.empty").text,
    historyDate: t("app.weather.history.date").text,
    historySeverity: t("app.weather.history.severity").text,
    historyStatus: t("app.weather.history.status").text,
    historyStatusNew: t("app.weather.history.status.new").text,
    historyStatusSeen: t("app.weather.history.status.seen").text,
    historyStatusActed: t("app.weather.history.status.acted").text,
    historyLoadMore: t("app.weather.history.loadMore").text,
    historyViewAll: t("app.weather.history.viewAll").text,
    detail: {
      back: t("app.weather.detail.back").text,
      weatherConditions: t("app.weather.detail.weatherConditions").text,
      recommendation: t("app.weather.detail.recommendation").text,
      markActed: t("app.weather.detail.markActed").text,
      markAcknowledged: t("app.weather.detail.markAcknowledged").text,
      markedActed: t("app.weather.detail.markedActed").text,
      markedSeen: t("app.weather.detail.markedSeen").text,
    },
    alerts: {
      title: t("app.weather.alerts.title").text,
      dismiss: t("app.weather.alerts.dismiss").text,
      noAlerts: t("app.weather.alerts.noAlerts").text,
      viewAll: t("app.weather.alerts.viewAll").text,
    },
    source: {
      live: t("app.weather.source.live").text,
      cached: t("app.weather.source.cached").text,
      demo: t("app.weather.source.demo").text,
    },
    stages: {
      seedling: t("app.weather.stages.seedling").text,
      vegetative: t("app.weather.stages.vegetative").text,
      flowering: t("app.weather.stages.flowering").text,
      maturation: t("app.weather.stages.maturation").text,
      harvestReady: t("app.weather.stages.harvestReady").text,
      generic: t("app.weather.stages.generic").text,
    },
    buttons: {
      register: t("app.weather.buttons.register").text,
      refresh: t("app.weather.buttons.refresh").text,
    },
    errors: {
      generic: t("app.weather.errors.generic").text,
      noFarm: t("app.weather.errors.noFarm").text,
    },
  };
}

/**
 * Flat translation bundle for the Mandi Price Tracker feature.
 * Built server-side and passed as props to client components.
 */
export async function getPricesBundle(): Promise<PricesBundle> {
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.t;
  return {
    eyebrow: t("app.prices.eyebrow").text,
    title: t("app.prices.title").text,
    description: t("app.prices.description").text,
    selectFarm: t("app.prices.selectFarm").text,
    selectCrop: t("app.prices.selectCrop").text,
    searchPlaceholder: t("app.prices.searchPlaceholder").text,
    globalSearchPlaceholder: t("app.prices.globalSearchPlaceholder").text,
    globalSearchCrops: t("app.prices.globalSearchCrops").text,
    globalSearchMandis: t("app.prices.globalSearchMandis").text,
    globalSearchNoResults: t("app.prices.globalSearchNoResults").text,
    globalSearchViewPrices: t("app.prices.globalSearchViewPrices").text,
    noData: t("app.prices.noData").text,
    updatedToday: t("app.prices.updatedToday").text,
    updatedDaysAgo: t("app.prices.updatedDaysAgo").text,
    marketHoliday: t("app.prices.marketHoliday").text,
    perMaund: t("app.prices.perMaund").text,
    bestPrice: t("app.prices.bestPrice").text,
    distanceKm: t("app.prices.distanceKm").text,
    transportCost: t("app.prices.transportCost").text,
    transport: t("app.prices.transport").text,
    hold: t("app.prices.hold").text,
    sell: t("app.prices.sell").text,
    recommendationHold: t("app.prices.recommendationHold").text,
    recommendationSell: t("app.prices.recommendationSell").text,
    volatilityWarning: t("app.prices.volatilityWarning").text,
    predictionTitle: t("app.prices.predictionTitle").text,
    historyTitle: t("app.prices.historyTitle").text,
    range1M: t("app.prices.range1M").text,
    range3M: t("app.prices.range3M").text,
    range6M: t("app.prices.range6M").text,
    range12M: t("app.prices.range12M").text,
    setAlert: t("app.prices.setAlert").text,
    editAlert: t("app.prices.editAlert").text,
    saveAlert: t("app.prices.saveAlert").text,
    cancel: t("app.prices.cancel").text,
    alertCrop: t("app.prices.alertCrop").text,
    alertMandi: t("app.prices.alertMandi").text,
    alertMandiOptional: t("app.prices.alertMandiOptional").text,
    alertStatus: t("app.prices.alertStatus").text,
    targetPrice: t("app.prices.targetPrice").text,
    alertActive: t("app.prices.alertActive").text,
    alertPaused: t("app.prices.alertPaused").text,
    deleteAlert: t("app.prices.deleteAlert").text,
    fallbackBanner: t("app.prices.fallbackBanner").text,
    comparisonTitle: t("app.prices.comparisonTitle").text,
    market: t("app.prices.market").text,
    modalPrice: t("app.prices.modalPrice").text,
    minPrice: t("app.prices.minPrice").text,
    maxPrice: t("app.prices.maxPrice").text,
    change: t("app.prices.change").text,
    distance: t("app.prices.distance").text,
    adminTitle: t("app.prices.adminTitle").text,
    adminDate: t("app.prices.adminDate").text,
    adminModalPrice: t("app.prices.adminModalPrice").text,
    adminMinPrice: t("app.prices.adminMinPrice").text,
    adminMaxPrice: t("app.prices.adminMaxPrice").text,
    adminHoliday: t("app.prices.adminHoliday").text,
    adminSave: t("app.prices.adminSave").text,
    loading: t("app.prices.loading").text,
    retry: t("app.prices.retry").text,
    noPricesForCrop: t("app.prices.noPricesForCrop").text,
    comingSoon: t("app.prices.comingSoon").text,
    favouriteAdd: t("app.prices.favouriteAdd").text,
    favouriteRemove: t("app.prices.favouriteRemove").text,
    dataSourceBadge: t("app.prices.dataSourceBadge").text,
  };
}

/**
 * Flat translation bundle for the crop recommendation feature.
 * Built server-side and passed as props to client components.
 */
export async function getCropsBundle(): Promise<CropsBundle> {
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.t;
  return {
    eyebrow: t("app.crops.eyebrow").text,
    title: t("app.crops.title").text,
    description: t("app.crops.description").text,
    nav: t("app.crops.nav").text,
    form: {
      farmLabel: t("app.crops.form.farmLabel").text,
      seasonLabel: t("app.crops.form.seasonLabel").text,
      yearLabel: t("app.crops.form.yearLabel").text,
      soilLabel: t("app.crops.form.soilLabel").text,
      irrigationLabel: t("app.crops.form.irrigationLabel").text,
      budgetLabel: t("app.crops.form.budgetLabel").text,
      soilOther: t("app.crops.form.soilOther").text,
      submit: t("app.crops.form.submit").text,
      submitting: t("app.crops.form.submitting").text,
      lowestViableWarning: t("app.crops.form.lowestViableWarning").text,
      switchBracket: t("app.crops.form.switchBracket").text,
      noFarm: t("app.crops.form.noFarm").text,
      geoError: t("app.crops.form.geoError").text,
      regionalSoilNote: t("app.crops.form.regionalSoilNote").text,
      nationalSoilNote: t("app.crops.form.nationalSoilNote").text,
    },
    seasons: {
      summer: t("app.crops.seasons.summer").text,
      winter: t("app.crops.seasons.winter").text,
      autumn: t("app.crops.seasons.autumn").text,
      spring: t("app.crops.seasons.spring").text,
      rainy: t("app.crops.seasons.rainy").text,
      windy: t("app.crops.seasons.windy").text,
    },
    soil: {
      sandy: t("app.crops.soil.sandy").text,
      sandy_loam: t("app.crops.soil.sandy_loam").text,
      loamy: t("app.crops.soil.loamy").text,
      clay_loam: t("app.crops.soil.clay_loam").text,
      clay: t("app.crops.soil.clay").text,
      silty: t("app.crops.soil.silty").text,
      saline: t("app.crops.soil.saline").text,
      rocky: t("app.crops.soil.rocky").text,
      other: t("app.crops.soil.other").text,
    },
    budget: {
      low: t("app.crops.budget.low").text,
      medium: t("app.crops.budget.medium").text,
      high: t("app.crops.budget.high").text,
      very_high: t("app.crops.budget.very_high").text,
    },
    irrigation: {
      rainfed: t("app.crops.irrigation.rainfed").text,
      canal: t("app.crops.irrigation.canal").text,
      tubewell: t("app.crops.irrigation.tubewell").text,
      mixed: t("app.crops.irrigation.mixed").text,
    },
    results: {
      title: t("app.crops.results.title").text,
      rank: t("app.crops.results.rank").text,
      revenue: t("app.crops.results.revenue").text,
      reason: t("app.crops.results.reason").text,
      risks: t("app.crops.results.risks").text,
      saveToPlan: t("app.crops.results.saveToPlan").text,
      saved: t("app.crops.results.saved").text,
      compare: t("app.crops.results.compare").text,
      projectionNote: t("app.crops.results.projectionNote").text,
      sourceWeather: t("app.crops.results.sourceWeather").text,
      sourceMarket: t("app.crops.results.sourceMarket").text,
      sourceSoil: t("app.crops.results.sourceSoil").text,
      weatherMissing: t("app.crops.results.weatherMissing").text,
      marketMissing: t("app.crops.results.marketMissing").text,
      soilMissing: t("app.crops.results.soilMissing").text,
      regenerate: t("app.crops.results.regenerate").text,
      regenerateConfirm: t("app.crops.results.regenerateConfirm").text,
      alreadyExists: t("app.crops.results.alreadyExists").text,
      viewExisting: t("app.crops.results.viewExisting").text,
      noCandidates: t("app.crops.results.noCandidates").text,
      replacedPlan: t("app.crops.results.replacedPlan").text,
    },
    detail: {
      title: t("app.crops.detail.title").text,
      back: t("app.crops.detail.back").text,
      confidence: t("app.crops.detail.confidence").text,
      scoreBreakdown: t("app.crops.detail.scoreBreakdown").text,
      suitability: t("app.crops.detail.suitability").text,
      weatherFit: t("app.crops.detail.weatherFit").text,
      profitability: t("app.crops.detail.profitability").text,
      risk: t("app.crops.detail.risk").text,
      sustainability: t("app.crops.detail.sustainability").text,
      final: t("app.crops.detail.final").text,
      dataFreshness: t("app.crops.detail.dataFreshness").text,
      soilImpact: t("app.crops.detail.soilImpact").text,
    },
    water: {
      low: t("app.crops.water.low").text,
      medium: t("app.crops.water.medium").text,
      high: t("app.crops.water.high").text,
    },
    confidence: {
      high: t("app.crops.confidence.high").text,
      medium: t("app.crops.confidence.medium").text,
      low: t("app.crops.confidence.low").text,
      unreliable: t("app.crops.confidence.unreliable").text,
    },
    risk: {
      price_volatility: t("app.crops.risk.price_volatility").text,
      pest_pressure: t("app.crops.risk.pest_pressure").text,
      weather: t("app.crops.risk.weather").text,
      water_stress: t("app.crops.risk.water_stress").text,
      input_cost: t("app.crops.risk.input_cost").text,
    },
    soilImpact: {
      improves: t("app.crops.soilImpact.improves").text,
      neutral: t("app.crops.soilImpact.neutral").text,
      depletes: t("app.crops.soilImpact.depletes").text,
    },
    compare: {
      title: t("app.crops.compare.title").text,
      close: t("app.crops.compare.close").text,
      revenue: t("app.crops.compare.revenue").text,
      duration: t("app.crops.compare.duration").text,
      water: t("app.crops.compare.water").text,
      marketRisk: t("app.crops.compare.marketRisk").text,
      soilImpact: t("app.crops.compare.soilImpact").text,
      labour: t("app.crops.compare.labour").text,
      chartAria: t("app.crops.compare.chartAria").text,
      chartUnavailable: t("app.crops.compare.chartUnavailable").text,
      selectToSave: t("app.crops.compare.selectToSave").text,
      saveSelected: t("app.crops.compare.saveSelected").text,
    },
    rotation: {
      title: t("app.crops.rotation.title").text,
      subtitle: t("app.crops.rotation.subtitle").text,
      generic: t("app.crops.rotation.generic").text,
      nextSeason: t("app.crops.rotation.nextSeason").text,
      savedTitle: t("app.crops.rotation.savedTitle").text,
    },
    catalogue: {
      empty: t("app.crops.catalogue.empty").text,
    },
    errors: {
      serviceUnavailable: t("app.crops.errors.serviceUnavailable").text,
      generic: t("app.crops.errors.generic").text,
      dataUnavailable: t("app.crops.errors.dataUnavailable").text,
      notFound: t("app.crops.errors.notFound").text,
      rateLimited: t("app.crops.errors.rateLimited").text,
    },
    reason: {
      suitability: t("app.crops.reason.suitability").text,
      weather_fit: t("app.crops.reason.weather_fit").text,
      profit: t("app.crops.reason.profit").text,
      rotation_fit: t("app.crops.reason.rotation_fit").text,
      low_risk: t("app.crops.reason.low_risk").text,
      generic: t("app.crops.reason.generic").text,
    },
    rotationKeys: {
      wheat_then_mung: t("app.crops.rotation.wheat_then_mung").text,
      wheat_then_chickpea: t("app.crops.rotation.wheat_then_chickpea").text,
      wheat_then_cotton: t("app.crops.rotation.wheat_then_cotton").text,
      cotton_then_wheat: t("app.crops.rotation.cotton_then_wheat").text,
      cotton_then_maize: t("app.crops.rotation.cotton_then_maize").text,
      rice_then_wheat: t("app.crops.rotation.rice_then_wheat").text,
      rice_then_maize: t("app.crops.rotation.rice_then_maize").text,
      maize_then_potato: t("app.crops.rotation.maize_then_potato").text,
      maize_then_wheat: t("app.crops.rotation.maize_then_wheat").text,
      potato_then_maize: t("app.crops.rotation.potato_then_maize").text,
      sugarcane_then_maize: t("app.crops.rotation.sugarcane_then_maize").text,
      mung_then_wheat: t("app.crops.rotation.mung_then_wheat").text,
      chickpea_then_cotton: t("app.crops.rotation.chickpea_then_cotton").text,
      mustard_then_cotton: t("app.crops.rotation.mustard_then_cotton").text,
      soybean_then_wheat: t("app.crops.rotation.soybean_then_wheat").text,
      onion_then_maize: t("app.crops.rotation.onion_then_maize").text,
      tomato_then_wheat: t("app.crops.rotation.tomato_then_wheat").text,
      barley_then_chickpea: t("app.crops.rotation.barley_then_chickpea").text,
      bajra_then_cowpea: t("app.crops.rotation.bajra_then_cowpea").text,
      sunflower_then_wheat: t("app.crops.rotation.sunflower_then_wheat").text,
      canola_then_wheat: t("app.crops.rotation.canola_then_wheat").text,
      lentil_then_cotton: t("app.crops.rotation.lentil_then_cotton").text,
      pea_then_maize: t("app.crops.rotation.pea_then_maize").text,
      cauliflower_then_pea: t("app.crops.rotation.cauliflower_then_pea").text,
      okra_then_cowpea: t("app.crops.rotation.okra_then_cowpea").text,
      garlic_then_wheat: t("app.crops.rotation.garlic_then_wheat").text,
    },
  };
}

/** Flat prop bundle for the client SiteHeader (functions can't cross the RSC boundary). */
export function siteHeaderStrings(t: Translator) {
  return {
    whyAgropioo: t("nav.whyAgropioo").text,
    features: t("nav.features").text,
    howItWorks: t("nav.howItWorks").text,
    vision: t("nav.vision").text,
    signIn: t("nav.signIn").text,
    signUp: t("nav.signUp").text,
    getEarlyAccess: t("nav.getEarlyAccess").text,
    openMenu: t("nav.openMenu").text,
    closeMenu: t("nav.closeMenu").text,
    languageSwitcher: t("common.languageSwitcherLabel").text,
    dashboard: t("nav.dashboard").text,
  };
}
