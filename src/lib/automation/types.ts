export type InquirySource = "quote" | "contact" | "appointment";

/**
 * Normalized shape all three intake forms (quote wizard, general inquiry,
 * appointment request) are mapped into before scoring/storage/notification.
 * Fields not collected by a given form are simply left undefined.
 */
export type NormalizedInquiry = {
  source: InquirySource;
  name: string;
  organization?: string;
  email: string;
  phone?: string;
  preferredContact?: string;
  projectType?: string;
  productDescription?: string;
  quantity?: string;
  budgetRange?: string;
  decorationMethod?: string;
  placements?: string;
  designHelp?: boolean;
  neededBy?: string;
  eventDate?: string;
  deliveryMethod?: string;
  postalCode?: string;
  message?: string;
  fileNames?: string[];
};

export type ScoredInquiry = NormalizedInquiry & {
  reference: string;
  score: number;
  tags: string[];
};
