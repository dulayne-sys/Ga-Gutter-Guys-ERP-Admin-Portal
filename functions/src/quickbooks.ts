import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import QuickBooks from "node-quickbooks";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

type QuickBooksConfig = {
  client_id?: string;
  client_secret?: string;
  environment?: "sandbox" | "production";
};

const getQuickBooksConfig = (): QuickBooksConfig => {
  const cfg = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : {};
  const runtime = (cfg?.quickbooks || {}) as QuickBooksConfig;

  return {
    client_id: process.env.QUICKBOOKS_CLIENT_ID || runtime.client_id,
    client_secret: process.env.QUICKBOOKS_CLIENT_SECRET || runtime.client_secret,
    environment: (process.env.QUICKBOOKS_ENVIRONMENT as "sandbox" | "production") || runtime.environment || "sandbox",
  };
};

async function getQBClient() {
  const tokenDoc = await db.collection("settings").doc("quickbooks").get();
  const tokens = tokenDoc.data();

  if (!tokens?.access_token) {
    throw new Error("QuickBooks not connected");
  }

  const cfg = getQuickBooksConfig();
  if (!cfg.client_id || !cfg.client_secret) {
    throw new Error("QuickBooks config missing");
  }

  return new QuickBooks(
    cfg.client_id,
    cfg.client_secret,
    String(tokens.access_token),
    false,
    String(tokens.realm_id),
    cfg.environment === "sandbox",
    true,
    null,
    "2.0",
    String(tokens.refresh_token || "")
  );
}

export const qbSyncCustomer = onDocumentCreated("customers/{customerId}", async (event) => {
  const customer = event.data?.data();
  if (!customer || !event.data) return;

  const customerId = event.params.customerId;
  logger.info(`Syncing customer to QuickBooks: ${customerId}`);

  try {
    const qbo = await getQBClient();

    const qbCustomer = {
      DisplayName: String(customer.name || ""),
      PrimaryEmailAddr: customer.primaryContact?.email ? { Address: String(customer.primaryContact.email) } : undefined,
      PrimaryPhone: customer.primaryContact?.phone ? { FreeFormNumber: String(customer.primaryContact.phone) } : undefined,
      BillAddr: customer.billingAddress ? {
        Line1: String(customer.billingAddress.street || ""),
        City: String(customer.billingAddress.city || ""),
        CountrySubDivisionCode: String(customer.billingAddress.state || ""),
        PostalCode: String(customer.billingAddress.zip || ""),
      } : undefined,
    };

    const result = await new Promise<{ Id: string }>((resolve, reject) => {
      qbo.createCustomer(qbCustomer, (err: unknown, createdCustomer: { Id: string }) => {
        if (err) reject(err);
        else resolve(createdCustomer);
      });
    });

    await event.data.ref.update({
      quickBooksCustomerId: result.Id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.error("Failed to sync customer to QuickBooks", { error, customerId });

    await event.data.ref.update({
      qbSyncError: error instanceof Error ? error.message : "unknown_error",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
});

export const qbCreateInvoice = onDocumentUpdated("jobs/{jobId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  const jobId = event.params.jobId;

  if (!before || !after || before.status === "completed" || after.status !== "completed") {
    return;
  }

  try {
    const estimateId = String(after.estimateId || "");
    const customerId = String(after.customerId || "");
    if (!estimateId || !customerId) {
      return;
    }

    const [estimateDoc, customerDoc] = await Promise.all([
      db.collection("estimates").doc(estimateId).get(),
      db.collection("customers").doc(customerId).get(),
    ]);

    const estimate = estimateDoc.data();
    const customer = customerDoc.data();

    if (!estimate || !customer?.quickBooksCustomerId) {
      return;
    }

    const qbo = await getQBClient();
    const materials = Array.isArray(estimate.materials) ? estimate.materials : [];

    const lineItems = materials.map((item: { total?: number; name?: string; qty?: number; unitPrice?: number }) => ({
      Amount: Number(item.total || 0),
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: { value: "1", name: String(item.name || "Service") },
        Qty: Number(item.qty || 1),
        UnitPrice: Number(item.unitPrice || item.total || 0),
      },
      Description: String(item.name || "Service"),
    }));

    const labor = estimate.labor as { total?: number; hours?: number; rate?: number } | undefined;
    if (labor?.total) {
      lineItems.push({
        Amount: Number(labor.total),
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: "1", name: "Labor" },
          Qty: Number(labor.hours || 1),
          UnitPrice: Number(labor.rate || labor.total),
        },
        Description: "Labor",
      });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const qbInvoice = {
      CustomerRef: { value: String(customer.quickBooksCustomerId) },
      Line: lineItems,
      DueDate: dueDate.toISOString().slice(0, 10),
      TxnDate: new Date().toISOString().slice(0, 10),
    };

    const created = await new Promise<{ Id: string }>((resolve, reject) => {
      qbo.createInvoice(qbInvoice, (err: unknown, invoice: { Id: string }) => {
        if (err) reject(err);
        else resolve(invoice);
      });
    });

    const invoiceQuery = await db.collection("invoices").where("jobId", "==", jobId).limit(1).get();
    if (!invoiceQuery.empty) {
      await invoiceQuery.docs[0].ref.update({
        quickBooksInvoiceId: created.Id,
        qbSyncStatus: "synced",
        status: "sent",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (error) {
    logger.error("Failed to create QuickBooks invoice", { error, jobId });
  }
});

export const qbWebhook = onRequest(async (req, res) => {
  logger.info("Received QuickBooks webhook");

  const payload = req.body as {
    eventNotifications?: Array<{
      dataChangeEvent?: {
        entities?: Array<{ name?: string; operation?: string; id?: string }>;
      };
    }>;
  };

  try {
    for (const notification of payload.eventNotifications || []) {
      for (const entity of notification.dataChangeEvent?.entities || []) {
        if (entity.name !== "Invoice" || entity.operation !== "Update" || !entity.id) {
          continue;
        }
        const entityId = entity.id;

        const invoiceQuery = await db.collection("invoices")
          .where("quickBooksInvoiceId", "==", entity.id)
          .limit(1)
          .get();

        if (invoiceQuery.empty) continue;

        const qbo = await getQBClient();
        const qbInvoice = await new Promise<{ Balance?: number; TotalAmt?: number }>((resolve, reject) => {
          qbo.getInvoice(entityId, (err: unknown, invoice: { Balance?: number; TotalAmt?: number }) => {
            if (err) reject(err);
            else resolve(invoice);
          });
        });

        if (Number(qbInvoice.Balance || 0) === 0 && Number(qbInvoice.TotalAmt || 0) > 0) {
          await invoiceQuery.docs[0].ref.update({
            status: "paid",
            payment: {
              paidAt: admin.firestore.FieldValue.serverTimestamp(),
              method: "quickbooks",
              txnId: entityId,
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }

    res.status(200).send("ok");
  } catch (error) {
    logger.error("Error processing QuickBooks webhook", { error });
    res.status(500).send("error");
  }
});

export const qbSyncNightly = onSchedule(
  {
    schedule: "0 2 * * *",
    timeZone: "America/New_York",
  },
  async () => {
    logger.info("Running nightly QuickBooks sync");

    try {
      const qbo = await getQBClient();
      const invoices = await db.collection("invoices")
        .where("qbSyncStatus", "==", "synced")
        .get();

      let syncedCount = 0;

      for (const invoiceDoc of invoices.docs) {
        const invoice = invoiceDoc.data();
        if (!invoice.quickBooksInvoiceId) continue;

        try {
          const qbInvoice = await new Promise<{ Balance?: number; TotalAmt?: number }>((resolve, reject) => {
            qbo.getInvoice(String(invoice.quickBooksInvoiceId), (err: unknown, result: { Balance?: number; TotalAmt?: number }) => {
              if (err) reject(err);
              else resolve(result);
            });
          });

          if (Number(qbInvoice.Balance || 0) === 0 && invoice.status !== "paid") {
            await invoiceDoc.ref.update({
              status: "paid",
              payment: {
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
                method: "quickbooks",
                txnId: String(invoice.quickBooksInvoiceId),
              },
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            syncedCount += 1;
          }
        } catch (error) {
          logger.error("Error syncing invoice", { invoiceId: invoiceDoc.id, error });
        }
      }

      logger.info("Nightly QuickBooks sync complete", { syncedCount });
    } catch (error) {
      logger.error("Nightly QuickBooks sync failed", { error });
    }
  }
);
