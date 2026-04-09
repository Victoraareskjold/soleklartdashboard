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

  ADMIN: "/admin",

  TEAM: "/team",
  PROFILE: "/profile",
};

export const NAVBAR_ROUTES = [
  { name: "Cold Calling", href: CLIENT_ROUTES.COLD_CALLING, adminOnly: false },
  { name: "Kontakter", href: CLIENT_ROUTES.CONTACTS, adminOnly: false },
  { name: "Avtaler", href: CLIENT_ROUTES.LEADS, adminOnly: false },

  { name: "Priskalkulator", href: CLIENT_ROUTES.PRICETABLE, adminOnly: false },

  { name: "Admin", href: CLIENT_ROUTES.ADMIN, adminOnly: true },

  { name: "Team", href: CLIENT_ROUTES.TEAM, adminOnly: false },
  { name: "Profil", href: CLIENT_ROUTES.PROFILE, adminOnly: false },
];
