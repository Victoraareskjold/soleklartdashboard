export const supplierCategoryConfig = {
  SOLCELLEPANEL: {
    label: "Solcellepanel",
    sections: [
      {
        title: "Solcellemodul",
        key: "solarPanel",
      },
    ],
  },

  INVERTER: {
    label: "Inverter",
    sections: [
      { title: "INVERTER 3 FAS 230V IT/TT", key: "inverter3Fas230" },
      { title: "INVERTER 3 FAS 400V TN", key: "inverter3Fas400" },
      { title: "INVERTER 1 FAS 230V IT/TT", key: "inverter1Fas230" },
      {
        title: "HYBRID INVERTER 3 FAS 230V IT/TT",
        key: "hybridInverter3Fas230",
      },
      { title: "HYBRID INVERTER 3 FAS 400V TN", key: "hybridInverter3Fas400" },
    ],
  },

  FESTEMATERIELL: {
    label: "Festemateriell",
    sections: [{ title: "Festeutstyr", key: "festeutstyr" }],
  },

  TILBEHØR: {
    label: "Tilbehør",
    sections: [{ title: "Annet", key: "annet" }],
  },
};
