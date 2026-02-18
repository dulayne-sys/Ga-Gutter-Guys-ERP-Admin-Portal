import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const onLeadCreated = onDocumentCreated("leads/{leadId}", async (event) => {
  const lead = event.data?.data();
  const leadId = event.params.leadId;

  if (!lead || !event.data) {
    return;
  }

  logger.info(`New lead created: ${leadId}`, {
    name: `${String(lead.firstName || "")} ${String(lead.lastName || "")}`.trim(),
    email: String(lead.email || ""),
    source: String(lead.leadSource || ""),
  });

  try {
    const salesReps = await db.collection("users")
      .where("role", "==", "sales")
      .where("active", "==", true)
      .get();

    if (!salesReps.empty) {
      const repCounts = await Promise.all(
        salesReps.docs.map(async (rep) => {
          const activeLeads = await db.collection("leads")
            .where("assignedTo", "==", rep.id)
            .where("status", "in", ["new", "contacted", "scheduled", "estimating"])
            .get();

          return {
            uid: rep.id,
            name: String(rep.data().displayName || rep.id),
            count: activeLeads.size,
          };
        })
      );

      const assignTo = repCounts.sort((left, right) => left.count - right.count)[0];

      await event.data.ref.update({
        assignedTo: assignTo.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(`Assigned lead ${leadId} to ${assignTo.name}`);
    }

    const nextFollowUp = new Date();
    nextFollowUp.setHours(nextFollowUp.getHours() + 24);

    await event.data.ref.update({
      nextFollowUpAt: admin.firestore.Timestamp.fromDate(nextFollowUp),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.error("Error processing new lead", { error, leadId });
  }
});

export const onEstimateApproved = onDocumentUpdated("estimates/{estimateId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  const estimateId = event.params.estimateId;

  if (!before || !after || !event.data?.after) {
    return;
  }

  if (before.status === "approved" || after.status !== "approved") {
    return;
  }

  logger.info(`Estimate approved: ${estimateId}`);

  try {
    let customerId = String(after.customerId || "") || null;

    if (!customerId && after.leadId) {
      const leadDoc = await db.collection("leads").doc(String(after.leadId)).get();
      const lead = leadDoc.data();

      if (lead) {
        const customerRef = await db.collection("customers").add({
          name: `${String(lead.firstName || "")} ${String(lead.lastName || "")}`.trim(),
          primaryContact: {
            name: `${String(lead.firstName || "")} ${String(lead.lastName || "")}`.trim(),
            phone: String(lead.phone || ""),
            email: String(lead.email || ""),
          },
          serviceAddress: lead.address || null,
          billingAddress: lead.address || null,
          leadId: String(after.leadId),
          quickBooksCustomerId: null,
          tags: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        customerId = customerRef.id;

        await event.data.after.ref.update({
          customerId,
          approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await db.collection("leads").doc(String(after.leadId)).update({
          status: "won",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    if (!customerId) {
      logger.warn("No customer ID available for approved estimate", { estimateId });
      return;
    }

    const jobRef = await db.collection("jobs").add({
      customerId,
      estimateId,
      status: "scheduled",
      schedule: {
        installDate: null,
        arrivalWindow: "",
        crew: [],
      },
      jobNotes: "",
      photos: [],
      completion: {
        completedAt: null,
        completedBy: null,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const pricing = (after.pricing as { grandTotal?: number } | undefined)?.grandTotal;

    await db.collection("invoices").add({
      jobId: jobRef.id,
      customerId,
      estimateId,
      status: "draft",
      amountDue: Number(pricing || 0),
      dueDate: admin.firestore.Timestamp.fromDate(dueDate),
      quickBooksInvoiceId: null,
      qbSyncStatus: "pending",
      payment: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.error("Error processing approved estimate", { error, estimateId });
  }
});

export const followUpReminderRunner = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "America/New_York",
  },
  async () => {
    logger.info("Running follow-up reminder check");

    const now = admin.firestore.Timestamp.now();
    const leadsNeedingFollowUp = await db.collection("leads")
      .where("status", "in", ["contacted", "scheduled", "estimating"])
      .where("nextFollowUpAt", "<=", now)
      .get();

    for (const leadDoc of leadsNeedingFollowUp.docs) {
      const nextFollowUp = new Date();
      nextFollowUp.setDate(nextFollowUp.getDate() + 3);

      await leadDoc.ref.update({
        nextFollowUpAt: admin.firestore.Timestamp.fromDate(nextFollowUp),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    logger.info("Follow-up reminder check complete", { count: leadsNeedingFollowUp.size });
  }
);
