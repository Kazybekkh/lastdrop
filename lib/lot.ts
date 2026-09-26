export interface Lot {
  id: string;
  title: string;
  quantity: number;
  weeksOnRail: number;
  wash: string;
  cloth: string;
  origin: string;
  hardware: string;
  why: string;
  costPence: number;
  askingPricePence: number;
  defaultFloorPence: number;
  rrpPence: number;
}

export const LOT: Lot = {
  id: "harbor-trucker-300",
  title: "Harbor & Co. trucker jacket",
  quantity: 300,
  weeksOnRail: 9,
  wash: "Mid-indigo, even, no whisker",
  cloth: "13.5 oz Japanese selvedge",
  origin: "Cut and sewn in Porto",
  hardware: "Brass, unworn, tickets on",
  why: "Too heavy for the high street. Too many for the boutique that wanted forty.",
  costPence: 1940,
  askingPricePence: 3800,
  defaultFloorPence: 2200,
  rrpPence: 11000,
};
