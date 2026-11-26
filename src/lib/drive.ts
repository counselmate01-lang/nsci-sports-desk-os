// Planned Google Drive folder structure (used for display now, and by the
// future Drive integration to create folders automatically).

export const DRIVE_ROOT = "NSCI SPORTS DESK";

const DEFAULT_SUBFOLDERS = ["Quotations", "Approvals", "Documents"];

export const DRIVE_STRUCTURE: Record<string, { folder: string; subfolders: string[] }> = {
  "recovery-space-ice-bath": { folder: "Recovery Space", subfolders: ["Quotations", "Approvals", "Documents"] },
  "yoga-sessions": { folder: "Yoga", subfolders: ["Registrations", "Equipment", "Social Media"] },
  "badminton-court-roofing": { folder: "Badminton Roofing", subfolders: ["Quotations", "Budget", "Approvals"] },
  "board-games-nights": { folder: "Board Games", subfolders: ["Quotations", "Approvals"] },
  "physio-sessions": { folder: "Physio", subfolders: ["Quotations", "SOP", "Social Media"] },
  "sports-events-knowledge-sessions": { folder: "Sports Events & Knowledge Sessions", subfolders: ["Session List", "Budget", "Approvals"] },
  "delhi-vs-mumbai-badminton-tournament": { folder: "Delhi vs Mumbai Tournament", subfolders: ["Concept", "Budget", "Approvals"] },
  "shuttle-order": { folder: "Shuttle Order", subfolders: ["Quotations", "Orders", "Inventory"] },
  "court-repair": { folder: "Court Repair", subfolders: ["Correspondence", "Quotations", "Approvals"] },
  "daily-cleaning-operations": { folder: "Operations", subfolders: ["Checklists", "Complaints"] },
};

export function driveFolderFor(slug: string, name: string) {
  return DRIVE_STRUCTURE[slug] ?? { folder: name, subfolders: DEFAULT_SUBFOLDERS };
}
