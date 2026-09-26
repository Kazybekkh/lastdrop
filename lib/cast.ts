export const CAST = {
  merchant: {
    id: "merchant",
    name: "Nell",
    role: "Merchant pitcher",
    trait: "Holds the floor",
    thinking: "Nell is opening the rail",
  },
  denim: {
    id: "denim",
    name: "Mara",
    role: "Denim hunter",
    trait: "Pays for ounces",
    thinking: "Mara is checking the ounces",
  },
  bargain: {
    id: "bargain",
    name: "Len",
    role: "Bargain hunter",
    trait: "Walks fast",
    thinking: "Len is looking for the exit price",
  },
  premium: {
    id: "premium",
    name: "Ida",
    role: "Premium buyer",
    trait: "Won't buy a dump",
    thinking: "Ida is counting clean units",
  },
} as const;

export type CastId = keyof typeof CAST;
