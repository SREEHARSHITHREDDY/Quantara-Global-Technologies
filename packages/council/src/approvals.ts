/** Maps an agent-requested action to the approval categories the specification lists. Keyword based and deliberately conservative: anything unrecognized is an EXTERNAL_ACTION, which still needs a human. */
export const APPROVAL_CATEGORIES = [
  "FINANCIAL_TRANSFER", "PAYMENT", "CONTRACT_SIGNING", "LEGALLY_BINDING_COMMUNICATION",
  "HIRING_OR_TERMINATION", "PRODUCTION_INFRASTRUCTURE_CHANGE", "RESTRICTED_RECORD_ACCESS", "EXTERNAL_ACTION",
] as const;
export type ApprovalCategoryId = (typeof APPROVAL_CATEGORIES)[number];

export const APPROVAL_CATEGORY_LABELS: Record<ApprovalCategoryId, string> = {
  FINANCIAL_TRANSFER: "Financial transfer", PAYMENT: "Payment", CONTRACT_SIGNING: "Contract signing",
  LEGALLY_BINDING_COMMUNICATION: "Legally binding communication", HIRING_OR_TERMINATION: "Hiring or termination",
  PRODUCTION_INFRASTRUCTURE_CHANGE: "Production infrastructure change", RESTRICTED_RECORD_ACCESS: "Restricted record access", EXTERNAL_ACTION: "External action",
};

const RULES: [ApprovalCategoryId, RegExp][] = [
  ["HIRING_OR_TERMINATION", /\b(hir(e|es|ing)|recruit\w*|terminat\w*|dismiss\w*|lay ?off|redundanc\w*|offer letter|fire|firing)\b/i],
  ["CONTRACT_SIGNING", /\b(contract\w*|sign(ing|ature)?|agreement|nda|mou|lease)\b/i],
  ["FINANCIAL_TRANSFER", /\b(transfer\w*|wire|remit\w*|fund(s|ing)? (the|a)|move funds|capital injection)\b/i],
  ["PAYMENT", /\b(pay(ment|ments|ing)?|invoice\w*|purchase|deposit|refund|disburse\w*)\b/i],
  ["LEGALLY_BINDING_COMMUNICATION", /\b(legal notice|binding|regulator\w*|filing|file with|submit(ting)? to|formal notice|statutory)\b/i],
  ["PRODUCTION_INFRASTRUCTURE_CHANGE", /\b(deploy\w*|production|infrastructure|migrat\w*|data ?cent(er|re)|server\w*|rollout|cut ?over)\b/i],
  ["RESTRICTED_RECORD_ACCESS", /\b(restricted|confidential|personal data|employee records?|customer records?|access to (the )?(records?|data))\b/i],
];

export function classifyApproval(action: string): ApprovalCategoryId {
  for (const [cat, re] of RULES) if (re.test(action)) return cat;
  return "EXTERNAL_ACTION";
}

/** How long a request stays open before it expires unanswered. */
export const APPROVAL_TTL_DAYS = 30;
export const MAX_DECISION_NOTE = 1000;
