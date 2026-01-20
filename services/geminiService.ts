// This service is not used in the Vendor Booking Portal.
// The functions have been deactivated to avoid confusion.

export const summarizeWebsite = async (url: string): Promise<string> => {
  console.warn("summarizeWebsite is not an active feature in this application.");
  return Promise.resolve("Website analysis is not available.");
};

export const suggestBdm = async (prospectInfo: string, bdms: any[]): Promise<string> => {
  console.warn("suggestBdm is not an active feature in this application.");
  return Promise.resolve("BDM suggestion is not available.");
};
