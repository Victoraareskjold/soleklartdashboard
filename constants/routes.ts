export const CLIENT_ROUTES = {
  AUTH: "/auth",

  DASHBOARD: "/dashboard",

  LEADS: "/dashboard/leads",
  CREATE_LEAD: "/dashboard/leads/create",

  PRICETABLE: "/dashboard/pricetable",

  TEAM: "/dashboard/team",
  PROFILE: "/dashboard/profile",
};

export const NAVBAR_ROUTES = [
  { name: "Avtaler", href: CLIENT_ROUTES.LEADS },
  { name: "Priskalkulator", href: CLIENT_ROUTES.PRICETABLE },
  { name: "Team", href: CLIENT_ROUTES.TEAM },
  { name: "Profil", href: CLIENT_ROUTES.PROFILE },
];
