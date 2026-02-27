/**
 * Firestore Collections Initialization Script
 * Run this ONCE to set up the database structure
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

async function initializeCollections() {
  console.log("🔧 Initializing Firestore collections...");

  await db.collection("users").doc("admin-default").set({
    displayName: "Admin User",
    email: "admin@gagutterguys.com",
    phone: "",
    role: "admin",
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log("✅ Created default admin user");

  const materials = [
    {
      sku: 'GUTTER-5IN-ALU',
      name: '5" Aluminum Gutter',
      category: "Gutters",
      unit: "LF",
      cost: 2.50,
      price: 12.00,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      sku: 'GUTTER-6IN-ALU',
      name: '6" Aluminum Gutter',
      category: "Gutters",
      unit: "LF",
      cost: 3.00,
      price: 15.00,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      sku: "DOWNSPOUT-3X4",
      name: "3x4 Downspout",
      category: "Downspouts",
      unit: "LF",
      cost: 2.00,
      price: 10.00,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      sku: "ELBOW-A",
      name: "A-Style Elbow",
      category: "Fittings",
      unit: "EA",
      cost: 1.50,
      price: 8.00,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      sku: "BRACKET",
      name: "Gutter Bracket",
      category: "Hardware",
      unit: "EA",
      cost: 0.50,
      price: 3.00,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  for (const material of materials) {
    await db.collection("materials").add(material);
  }
  console.log("✅ Created materials catalog");

  await db.collection("settings").doc("org").set({
    taxRate: 0.07,
    defaultMarginPct: 0.40,
    serviceAreas: ["Atlanta Metro", "North Georgia"],
    branding: {
      companyName: "GA Gutter Guys",
      phone: "(XXX) XXX-XXXX",
      email: "info@gagutterguys.com",
    },
    qbSyncEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log("✅ Created org settings");

  console.log("🎉 Firestore initialization complete!");
}

initializeCollections().catch((error) => {
  console.error(error);
  process.exit(1);
});
