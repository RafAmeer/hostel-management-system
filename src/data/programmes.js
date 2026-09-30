// Programmes offered at i-CATS University College, grouped by level so the
// Complete Profile form can show a categorised dropdown instead of a free
// text box. Source: the programme list on icats.edu.my/programmes.
// The stored value in `profiles.programme` is just the programme name.
export const PROGRAMME_GROUPS = [
  {
    label: "Foundation",
    programmes: ["Foundation in Management", "Foundation in Science"],
  },
  {
    label: "Diploma",
    programmes: [
      "Diploma in Software Engineering",
      "Diploma in Electrical Engineering (Power)",
      "Diploma in Mechanical Engineering",
      "Diploma in Civil Engineering",
      "Diploma in Accounting",
      "Diploma in Business Administration",
      "Diploma in Culinary Arts",
      "Diploma in Hotel Management",
      "Diploma in Early Childhood Care & Education",
      "Diploma in Plantation Science",
    ],
  },
  {
    label: "Bachelor's Degree",
    programmes: [
      "Bachelor of Software Engineering (Honours)",
      "Bachelor of Business Administration (Honours)",
      "Bachelor in Tourism & Hospitality (Honours)",
      "Bachelor of Science (Honours) in Agrotechnology",
      "Bachelor of Early Childhood Education with Honours",
      "Bachelor of Electrical and Electronics Engineering with Honours",
      "Bachelor of Aerospace Engineering with Honours",
    ],
  },
  {
    label: "Postgraduate",
    programmes: [
      "Master of Business Administration",
      "Master in Information Technology Management",
      "Master of Engineering",
      "Master of Science in Tourism and Hospitality Management",
      "Master of Information Technology",
      "PhD in Education",
      "PhD in Entrepreneurship",
      "PhD in Economics",
      "PhD in Tourism and Hospitality Management",
    ],
  },
];

export const OTHER_PROGRAMME = "__other__";

export const ALL_PROGRAMMES = PROGRAMME_GROUPS.flatMap((g) => g.programmes);

// A saved programme that isn't in the list (typed by hand before this
// dropdown existed) is shown under "Other" so nothing is lost on edit.
export function isKnownProgramme(value) {
  return ALL_PROGRAMMES.includes(value);
}
