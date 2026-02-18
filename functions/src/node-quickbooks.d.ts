declare module "node-quickbooks" {
  export default class QuickBooks {
    constructor(
      consumerKey: string,
      consumerSecret: string,
      token: string,
      tokenSecret: boolean,
      realmId: string,
      useSandbox: boolean,
      debug: boolean,
      minorversion: string | null,
      oAuthVersion: string,
      refreshToken: string
    );

    createCustomer(payload: unknown, callback: (err: unknown, customer: { Id: string }) => void): void;
    createInvoice(payload: unknown, callback: (err: unknown, invoice: { Id: string }) => void): void;
    getInvoice(invoiceId: string, callback: (err: unknown, invoice: { Balance?: number; TotalAmt?: number }) => void): void;
  }
}
