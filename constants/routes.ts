export const CLIENT_ROUTES = {
  HOME: "/",
  AUTH: "/auth",
  ONBOARDING: "/onboarding",

  DASHBOARD: "/dashboard",
  OVERVIEW: "/dashboard/overview",

  LEADS: "/dashboard/leads",
  CREATE_LEAD: "/dashboard/leads/create",
  COLD_CALLING: "/dashboard/coldCalling",
  CONTACTS: "/dashboard/contacts",

  PRICETABLE: "/dashboard/pricetable",

  ADMIN: "/dashboard/admin",
  MAIL_TEMPLATES: "/dashboard/admin/mail-templates",

  TEAM: "/dashboard/team",
  PROFILE: "/dashboard/profile",
};

export const NAVBAR_ROUTES = [
  { name: "Cold Calling", href: CLIENT_ROUTES.COLD_CALLING, adminOnly: false },
  { name: "Kontakter", href: CLIENT_ROUTES.CONTACTS, adminOnly: false },
  { name: "Avtaler", href: CLIENT_ROUTES.LEADS, adminOnly: false },

  { name: "Priskalkulator", href: CLIENT_ROUTES.PRICETABLE, adminOnly: false },

  { name: "Admin", href: CLIENT_ROUTES.ADMIN, adminOnly: true },
  { name: "E-postmaler", href: CLIENT_ROUTES.MAIL_TEMPLATES, adminOnly: true },

  { name: "Team", href: CLIENT_ROUTES.TEAM, adminOnly: false },
  { name: "Profil", href: CLIENT_ROUTES.PROFILE, adminOnly: false },
];
