export const CLIENT_ROUTES = {
  AUTH: "/auth",
  ONBOARDING: "/onboarding",

  DASHBOARD: "/",
  OVERVIEW: "/overview",

  LEADS: "/leads",
  CREATE_LEAD: "/leads/create",
  COLD_CALLING: "/coldCalling",
  CONTACTS: "/contacts",

  PRICETABLE: "/pricetable",

  TEAM: "/team",
  PROFILE: "/profile",
};

export const NAVBAR_ROUTES = [
  { name: "Cold Calling", href: CLIENT_ROUTES.COLD_CALLING },
  { name: "Contacts", href: CLIENT_ROUTES.CONTACTS },
  { name: "Avtaler", href: CLIENT_ROUTES.LEADS },

  { name: "Priskalkulator", href: CLIENT_ROUTES.PRICETABLE },

  { name: "Team", href: CLIENT_ROUTES.TEAM },
  { name: "Profil", href: CLIENT_ROUTES.PROFILE },
];
