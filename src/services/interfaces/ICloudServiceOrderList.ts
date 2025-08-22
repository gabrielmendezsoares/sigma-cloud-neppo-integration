import { ICloudServiceOrder } from "./index.js";

export interface ICloudServiceOrderList {
  content: ICloudServiceOrder.ICloudServiceOrder[]; 
  last: boolean;
}
