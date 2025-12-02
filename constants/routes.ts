export const CLIENT_ROUTES = {
  AUTH: "/auth",
  ONBOARDING: "/onboarding",

  DASHBOARD: "/",
  OVERVIEW: "/overview",

  LEADS: "/leads",
  CREATE_LEAD: "/leads/create",

  PRICETABLE: "/pricetable",

  TEAM: "/team",
  PROFILE: "/profile",
};

export const NAVBAR_ROUTES = [
  { name: "Avtaler", href: CLIENT_ROUTES.LEADS },
  { name: "Priskalkulator", href: CLIENT_ROUTES.PRICETABLE },
  { name: "Team", href: CLIENT_ROUTES.TEAM },
  { name: "Profil", href: CLIENT_ROUTES.PROFILE },
];
